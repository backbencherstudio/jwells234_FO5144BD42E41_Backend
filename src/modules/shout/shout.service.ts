import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateShoutDto } from './dto/create-shout.dto';
import { UpdateShoutDto } from './dto/update-shout.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { SazedStorage } from '../../common/lib/Disk/SazedStorage';
import { StringHelper } from '../../common/helper/string.helper';
import { CreateCommentDto } from './dto/create-comment.dto';
import { NotificationRepository } from '../../common/repository/notification/notification.repository';

@Injectable()
export class ShoutService {
  constructor(private prisma: PrismaService) {}

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
  ) {
    const {
      content,
      category,
      location,
      latitude,
      longitude,
      is_anonymous,
      audio_duration,
    } = createShoutDto;

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

        await SazedStorage.put(path, image.buffer);
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

      await SazedStorage.put(path, audio.buffer);
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

    const createdShout = await this.getPostById(shout.id, userId);

    return {
      success: true,
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
      throw new NotFoundException('User ID is required');
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
      throw new NotFoundException('User not found');
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
      throw new NotFoundException('Shout not found');
    }

    const transformedShout = this.transformShout(shout, userId);

    return {
      success: true,
      data: transformedShout,
    };
  }

  async updatePost(id: string, userId: string, updateShoutDto: UpdateShoutDto) {
    try {
      const shout = await this.prisma.shout.findUnique({ where: { id } });

      if (!shout || shout.user_id !== userId) {
        throw new NotFoundException('Shout not found or unauthorized');
      }

      await this.prisma.shout.update({
        where: { id },
        data: updateShoutDto,
      });

      const updatedShout = await this.getPostById(id, userId);

      return {
        success: true,
        message: 'Shout updated successfully',
        data: updatedShout,
      };
    } catch (error) {
      console.error('Error updating shout:', error);
      throw new NotFoundException('Failed to update shout');
    }
  }

  async deletePost(id: string, userId: string) {
    const shout = await this.prisma.shout.findUnique({ where: { id } });

    if (!shout || shout.user_id !== userId) {
      throw new NotFoundException('Shout not found or unauthorized');
    }

    await this.prisma.shout.delete({ where: { id } });

    return {
      success: true,
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

          await NotificationRepository.createNotification({
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
        message: 'Shout liked',
      };
    } catch (error) {
      // Likely already liked
      return {
        success: false,
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
            await NotificationRepository.createNotification({
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
            await NotificationRepository.createNotification({
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
        message: 'Comment added',
        data: comment,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to add comment',
      };
    }
  }

  async getComments(id: string, page = 1, limit = 20) {
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
            },
          },
        },
      });

      return {
        success: true,
        message: 'Comments fetched',
        data: comments,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch comments',
      };
    }
  }

  async share(id: string, userId: string, createShoutDto: CreateShoutDto) {
    // Sharing creates a new shout referencing the original
    const originalShout = await this.prisma.shout.findUnique({ where: { id } });
    if (!originalShout) throw new NotFoundException('Original shout not found');

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

          await NotificationRepository.createNotification({
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
        message: 'Shout shared successfully',
        shout: result,
      };
    } catch (error) {
      return {
        success: false,
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
          message: 'Shout not found',
        };
      }

      if (existingShout.user_id === userId) {
        return {
          success: false,
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
        message: 'Shout reported',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to report shout',
      };
    }
  }
}
