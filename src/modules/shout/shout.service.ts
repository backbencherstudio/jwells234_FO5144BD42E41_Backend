import { Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { CreateShoutDto } from './dto/create-shout.dto';
import { UpdateShoutDto } from './dto/update-shout.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { SazedStorage } from '../../common/lib/Disk/SazedStorage';
import { StringHelper } from '../../common/helper/string.helper';
import { CreateCommentDto } from './dto/create-comment.dto';
import { NotificationService } from '../application/notification/notification.service';

@Injectable()
export class ShoutService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  private transformShout(shout: any, userId: string) {
    const isLiked = shout.likes && shout.likes.length > 0;

    try {
      // Handle anonymity
      if (shout.is_anonymous) {
        shout.user = {
          id: null,
          name: 'Anonymous User',
          username: 'anonymous',
          avatar: null, // Or a default anonymous avatar url
        };
      }

      return {
        ...shout,
        is_liked: isLiked,
        likes_count: shout._count.likes,
        comments_count: shout._count.comments,
        shares_count: shout._count.shares,
        likes: undefined, // Remove raw likes array
        _count: undefined,
      };
    } catch (error) {
      console.error('Error transforming shout:', error);
      return shout;
    }
  }

  async createPost(
    userId: string,
    createShoutDto: CreateShoutDto,
    images?: Express.Multer.File[],
    audio?: Express.Multer.File,
    videos?: Express.Multer.File[],
  ) {
    const getFileBytes = async (file: Express.Multer.File): Promise<Buffer> => {
      if (file?.buffer && Buffer.isBuffer(file.buffer)) {
        return file.buffer;
      }
      // If using disk storage, Multer provides a file.path; read it.
      const anyFile = file as any;
      if (anyFile?.path && typeof anyFile.path === 'string') {
        return await readFile(anyFile.path);
      }
      throw new Error('Uploaded file data is missing (no buffer/path)');
    };

    const {
      content,
      category,
      location,
      latitude,
      longitude,
      is_anonymous,
      audio_duration,
    } = createShoutDto;

    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      return {
        success: false,
        statusCode: 401,
        message: 'Invalid or missing user. Please login again.',
      };
    }

    const shout = await this.prisma.shout.create({
      data: {
        user_id: userId,
        content,
        category,
        location,
        latitude,
        longitude,
        is_anonymous: is_anonymous || false,
      },
    });

    // Handle Images
    if (images && images.length > 0) {
      for (const image of images) {
        const safeName = image.originalname
          .toLowerCase()
          .replace(/[^a-z0-9.\s-_]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
        const fileName = `${StringHelper.randomString()}-${safeName}`;
        const path = `shouts/${shout.id}/images/${fileName}`;

        const bytes = await getFileBytes(image);
        await SazedStorage.put(path, bytes);
        const url = SazedStorage.url(encodeURI(path));

        await this.prisma.shoutMedia.create({
          data: {
            shout_id: shout.id,
            type: 'IMAGE',
            url: url,
          },
        });
      }
    }

    // Handle Audio
    if (audio) {
      const safeName = audio.originalname
        .toLowerCase()
        .replace(/[^a-z0-9.\s-_]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      const fileName = `${StringHelper.randomString()}-${safeName}`;
      const path = `shouts/${shout.id}/audio/${fileName}`;

      const bytes = await getFileBytes(audio);
      await SazedStorage.put(path, bytes);
      const url = SazedStorage.url(encodeURI(path));

      await this.prisma.shoutMedia.create({
        data: {
          shout_id: shout.id,
          type: 'AUDIO',
          url: url,
          duration: audio_duration,
        },
      });
    }

    // Handle Video
    if (videos && videos.length > 0) {
      for (const video of videos) {
        const safeName = video.originalname
          .toLowerCase()
          .replace(/[^a-z0-9.\s-_]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
        const fileName = `${StringHelper.randomString()}-${safeName}`;
        const path = `shouts/${shout.id}/video/${fileName}`;

        const bytes = await getFileBytes(video);
        await SazedStorage.put(path, bytes);
        const url = SazedStorage.url(encodeURI(path));

        await this.prisma.shoutMedia.create({
          data: {
            shout_id: shout.id,
            type: 'VIDEO',
            url: url,
          },
        });
      }
    }

    const createdShout = await this.getPostById(shout.id, userId);

    return {
      success: true,
      statusCode: 201,
      message: 'Shout created successfully',
      shout: createdShout,
    };
  }

  async getAllPosts(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const shouts = await this.prisma.shout.findMany({
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        medias: true,
        _count: {
          select: {
            likes: true,
            comments: true,
            shares: true,
          },
        },
        likes: {
          where: { user_id: userId },
          select: { id: true },
        },
      },
    });

    const transformedShouts = shouts.map((shout) =>
      this.transformShout(shout, userId),
    );

    return {
      success: true,
      statusCode: 200,
      data: transformedShouts,
    };
  }

  async getUserProfileAndPosts(
    targetUserId: string,
    currentUserId: string,
    page = 1,
    limit = 10,
  ) {
    if (!targetUserId) {
      return {
        success: false,
        statusCode: 400,
        message: 'User ID is required',
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        about: true,
        country: true,
        city: true,
        state: true,
        created_at: true,
      },
    });
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: 'User not found',
      };
    }

    const skip = (page - 1) * limit;
    const isSelf = targetUserId === currentUserId;

    const whereClause: any = {
      user_id: targetUserId,
    };

    // If viewing another user's profile, hide anonymous posts
    if (!isSelf) {
      whereClause.is_anonymous = false;
    }

    const shouts = await this.prisma.shout.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        medias: true,
        _count: {
          select: {
            likes: true,
            comments: true,
            shares: true,
          },
        },
        likes: {
          where: { user_id: currentUserId },
          select: { id: true },
        },
      },
    });

    const transformedShouts = shouts.map((shout) =>
      this.transformShout(shout, currentUserId),
    );

    return {
      success: true,
      statusCode: 200,
      data: {
        profile: user,
        posts: transformedShouts,
      },
    };
  }

  async getPostById(id: string, userId: string) {
    const shout = await this.prisma.shout.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        medias: true,
        _count: {
          select: {
            likes: true,
            comments: true,
            shares: true,
          },
        },
        likes: {
          where: { user_id: userId },
          select: { id: true },
        },
      },
    });

    if (!shout) {
      return {
        success: false,
        statusCode: 404,
        message: 'Shout not found',
      };
    }

    const transformedShout = this.transformShout(shout, userId);

    return {
      success: true,
      statusCode: 200,
      data: transformedShout,
    };
  }

  async updatePost(id: string, userId: string, updateShoutDto: UpdateShoutDto) {
    try {
      const shout = await this.prisma.shout.findUnique({ where: { id } });

      if (!shout || shout.user_id !== userId) {
        return {
          success: false,
          statusCode: 404,
          message: 'Shout not found or unauthorized',
        };
      }

      await this.prisma.shout.update({
        where: { id },
        data: updateShoutDto,
      });

      const updatedShout = await this.getPostById(id, userId);

      return {
        success: true,
        statusCode: 200,
        message: 'Shout updated successfully',
        data: updatedShout,
      };
    } catch (error) {
      console.error('Error updating shout:', error);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to update shout',
      };
    }
  }

  async deletePost(id: string, userId: string) {
    const shout = await this.prisma.shout.findUnique({ where: { id } });

    if (!shout || shout.user_id !== userId) {
      return {
        success: false,
        statusCode: 404,
        message: 'Shout not found or unauthorized',
      };
    }

    await this.prisma.shout.delete({ where: { id } });

    return {
      success: true,
      statusCode: 200,
      message: 'Shout deleted',
    };
  }

  async like(id: string, userId: string) {
    try {
      await this.prisma.shoutLike.create({
        data: {
          shout_id: id,
          user_id: userId,
        },
      });

      // Notification
      try {
        const shout = await this.prisma.shout.findUnique({
          where: { id },
          select: { user_id: true },
        });

        if (shout && shout.user_id !== userId) {
          const liker = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, username: true },
          });
          const likerName = liker?.name || liker?.username || 'Someone';

          await this.notificationService.createNotification({
            sender_id: userId,
            receiver_id: shout.user_id,
            text: `${likerName} liked your shout`,
            type: 'message',
            entity_id: id,
          });
        }
      } catch (notifError) {
        console.error('Error sending like notification:', notifError);
      }

      return {
        success: true,
        statusCode: 200,
        message: 'Shout liked',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 409,
        message: 'Already liked',
      };
    }
  }

  async unlike(id: string, userId: string) {
    await this.prisma.shoutLike.deleteMany({
      where: {
        shout_id: id,
        user_id: userId,
      },
    });
    return {
      success: true,
      statusCode: 200,
      message: 'Shout unliked',
    };
  }

  async comment(
    id: string,
    userId: string,
    createCommentDto: CreateCommentDto,
  ) {
    try {
      const comment = await this.prisma.shoutComment.create({
        data: {
          shout_id: id,
          user_id: userId,
          content: createCommentDto.content,
          parent_id: createCommentDto.parent_id,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
        },
      });

      // Notification
      try {
        const commenterName =
          comment.user.name || comment.user.username || 'Someone';

        if (createCommentDto.parent_id) {
          // Reply Notification
          const parentComment = await this.prisma.shoutComment.findUnique({
            where: { id: createCommentDto.parent_id },
            select: { user_id: true },
          });

          if (parentComment && parentComment.user_id !== userId) {
            await this.notificationService.createNotification({
              sender_id: userId,
              receiver_id: parentComment.user_id,
              text: `${commenterName} replied to your comment`,
              type: 'comment',
              entity_id: id,
            });
          }
        } else {
          // Comment Notification
          const shout = await this.prisma.shout.findUnique({
            where: { id },
            select: { user_id: true },
          });

          if (shout && shout.user_id !== userId) {
            await this.notificationService.createNotification({
              sender_id: userId,
              receiver_id: shout.user_id,
              text: `${commenterName} commented on your shout`,
              type: 'comment',
              entity_id: id,
            });
          }
        }
      } catch (notifError) {
        console.error('Error sending comment notification:', notifError);
      }

      return {
        success: true,
        statusCode: 201,
        message: 'Comment added',
        data: comment,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to add comment',
      };
    }
  }

  async getComments(id: string, userId: string, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      const comments = await this.prisma.shoutComment.findMany({
        where: { shout_id: id, parent_id: null }, // Top level comments
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
          likes: { 
             where: { user_id: userId },
             select: { id: true }
          },
          _count: {
             select: { likes: true, replies: true }
          },
          replies: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  avatar: true,
                },
              },
               likes: {
                where: { user_id: userId },
                select: { id: true }
               },
               _count: {
                  select: { likes: true }
               },
            },
            orderBy: { created_at: 'asc' },
          },
        },
      });

      const transformComment = (comment: any) => ({
        ...comment,
        is_liked: comment.likes?.length > 0,
        likes_count: comment._count?.likes || 0,
        replies_count: comment._count?.replies || 0,
        likes: undefined,
        _count: undefined,
      });

      const transformedComments = comments.map((comment) => ({
        ...transformComment(comment),
        replies: comment.replies?.map((reply) => transformComment(reply)) || [],
      }));

      return {
        success: true,
        statusCode: 200,
        message: 'Comments fetched',
        data: transformedComments,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to fetch comments',
      };
    }
  }

  async likeComment(commentId: string, userId: string) {
    try {
      const comment = await this.prisma.shoutComment.findUnique({
        where: { id: commentId },
        select: { id: true, user_id: true, shout_id: true },
      });

      if (!comment) {
        return {
          success: false,
          statusCode: 404,
          message: 'Comment not found',
        };
      }

      await this.prisma.shoutCommentLike.create({
        data: {
          shout_comment_id: commentId,
          user_id: userId,
        },
      });

      // Notification
      try {
        if (comment.user_id !== userId) {
          const liker = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, username: true },
          });
          const likerName = liker?.name || liker?.username || 'Someone';

          await this.notificationService.createNotification({
            sender_id: userId,
            receiver_id: comment.user_id,
            text: `${likerName} liked your comment`,
            type: 'like_comment',
            entity_id: commentId, // Or shout_id depending on how FE wants to navigate
          });
        }
      } catch (notifError) {
        console.error('Error sending comment like notification:', notifError);
      }

      return {
        success: true,
        statusCode: 200,
        message: 'Comment liked',
      };
    } catch (error) {
      if (error.code === 'P2002') {
         return {
          success: false,
          statusCode: 409,
          message: 'Already liked',
        };
      }
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to like comment',
      };
    }
  }

  async unlikeComment(commentId: string, userId: string) {
    try {
      await this.prisma.shoutCommentLike.deleteMany({
        where: {
          shout_comment_id: commentId,
          user_id: userId,
        },
      });
      return {
        success: true,
        statusCode: 200,
        message: 'Comment unliked',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to unlike comment',
      };
    }
  }

  async deleteComment(commentId: string, userId: string) {
    try {
      const comment = await this.prisma.shoutComment.findUnique({
        where: { id: commentId },
      });
      
      if (!comment) {
        return {
          success: false,
          statusCode: 404,
          message: 'Comment not found',
        };
      }

      if (comment.user_id !== userId) {
        return {
          success: false,
          statusCode: 403,
          message: 'You are not authorized to delete this comment',
        };
      }

      await this.prisma.shoutComment.delete({ where: { id: commentId } });
      return {
        success: true,
        statusCode: 200,
        message: 'Comment deleted',
      };
    } catch (error) {
       return {
        success: false,
        statusCode: 500,
        message: 'Failed to delete comment',
      };
    }
  }

  async share(id: string, userId: string, createShoutDto: CreateShoutDto) {
    // Sharing creates a new shout referencing the original
    const originalShout = await this.prisma.shout.findUnique({ where: { id } });
    if (!originalShout) {
      return {
        success: false,
        statusCode: 404,
        message: 'Original shout not found',
      };
    }

    try {
      const shout = await this.prisma.shout.create({
        data: {
          user_id: userId,
          content: createShoutDto.content, // User can add their own text
          original_shout_id: id,
          is_anonymous: createShoutDto.is_anonymous || false,
        },
      });

      // Notification
      try {
        if (originalShout.user_id !== userId) {
          const sharer = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, username: true },
          });
          const sharerName = sharer?.name || sharer?.username || 'Someone';

          await this.notificationService.createNotification({
            sender_id: userId,
            receiver_id: originalShout.user_id,
            text: `${sharerName} shared your shout`,
            type: 'message',
            entity_id: shout.id,
          });
        }
      } catch (notifError) {
        console.error('Error sending share notification:', notifError);
      }

      const result = await this.getPostById(shout.id, userId);
      return {
        success: true,
        statusCode: 201,
        message: 'Shout shared successfully',
        shout: result,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to share shout',
      };
    }
  }

  async report(id: string, userId: string, reason: string) {
    try {
      const existingShout = await this.prisma.shout.findUnique({
        where: { id },
      });
      if (!existingShout) {
        return {
          success: false,
          statusCode: 404,
          message: 'Shout not found',
        };
      }

      if (existingShout.user_id === userId) {
        return {
          success: false,
          statusCode: 400,
          message: 'You cannot report your own shout',
        };
      }

      const existingReport = await this.prisma.shoutReport.findFirst({
        where: {
          shout_id: id,
          user_id: userId,
        },
      });
      if (existingReport) {
        return {
          success: false,
          statusCode: 409,
          message: 'You have already reported this shout',
        };
      }

      await this.prisma.shoutReport.create({
        data: {
          shout_id: id,
          user_id: userId,
          reason,
        },
      });
      return {
        success: true,
        statusCode: 201,
        message: 'Shout reported',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to report shout',
      };
    }
  }
}
