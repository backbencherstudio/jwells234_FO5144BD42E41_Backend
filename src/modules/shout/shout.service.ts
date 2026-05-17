import { Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { CreateShoutDto } from './dto/create-shout.dto';
import { UpdateShoutDto } from './dto/update-shout.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { SazedStorage } from '../../common/lib/Disk/SazedStorage';
import { StringHelper } from '../../common/helper/string.helper';
import { CreateCommentDto } from './dto/create-comment.dto';
import { NotificationService } from '../application/notification/notification.service';
import { UserStatus } from '@prisma/client';

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

  private async getHiddenUserIds(currentUserId: string) {
    const [blockedUsers, bannedUsers] = await Promise.all([
      this.prisma.userBlock.findMany({
        where: {
          blocker_user_id: currentUserId,
          deleted_at: null,
        },
        select: { blocked_user_id: true },
      }),
      this.prisma.user.findMany({
        where: {
          status: UserStatus.BANNED,
          deleted_at: null,
        },
        select: { id: true },
      }),
    ]);

    return new Set([
      ...blockedUsers.map((item) => item.blocked_user_id),
      ...bannedUsers.map((item) => item.id),
    ]);
  }

  private isHiddenShout(shout: any, hiddenUserIds: Set<string>) {
    if (!shout) {
      return true;
    }

    const originalAuthorId = shout.original_shout?.user_id;
    return (
      hiddenUserIds.has(shout.user_id) ||
      hiddenUserIds.has(originalAuthorId) ||
      shout.user?.status === UserStatus.BANNED ||
      shout.original_shout?.user?.status === UserStatus.BANNED
    );
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
    const hiddenUserIds = await this.getHiddenUserIds(userId);
    // Try to get the requesting user's coordinates. If not present, fall back to time-based feed.
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { latitude: true, longitude: true },
    });

    // Helper: compute Haversine distance (meters)
    const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const toRad = (v: number) => (v * Math.PI) / 180;
      const R = 6371000; // Earth radius in meters
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // If user has no location, preserve existing behavior (recent first)
    if (!currentUser || currentUser.latitude == null || currentUser.longitude == null) {
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
              status: true,
            },
          },
          medias: true,
          _count: { select: { likes: true, comments: true, shares: true } },
          likes: { where: { user_id: userId }, select: { id: true } },
          original_shout: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  avatar: true,
                  status: true,
                },
              },
              medias: true,
              _count: { select: { likes: true, comments: true, shares: true } },
              likes: { where: { user_id: userId }, select: { id: true } },
            },
          },
        },
      });

      const transformedShouts = shouts
        .filter((shout) => !this.isHiddenShout(shout, hiddenUserIds))
        .map((shout) => {
          const transformed = this.transformShout(shout, userId);
          if (shout.original_shout) {
            transformed.original_shout = this.transformShout(
              shout.original_shout,
              userId,
            );
          }
          return transformed;
        });

      return {
        success: true,
        statusCode: 200,
        data: transformedShouts,
      };
    }

    // Fetch shouts that have coordinates (nearby feed)
    // Note: for performance we limit the initial fetch to a reasonable cap and then paginate after sorting.
    const FETCH_CAP = 2000;
    const rawShouts = await this.prisma.shout.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        deleted_at: null,
        status: 'PUBLISHED',
      },
      take: FETCH_CAP,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            status: true,
          },
        },
        medias: true,
        _count: { select: { likes: true, comments: true, shares: true } },
        likes: { where: { user_id: userId }, select: { id: true } },
        original_shout: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
                status: true,
              },
            },
            medias: true,
            _count: { select: { likes: true, comments: true, shares: true } },
            likes: { where: { user_id: userId }, select: { id: true } },
          },
        },
      },
    });

    const userLat = Number(currentUser.latitude);
    const userLon = Number(currentUser.longitude);

    const withDistance = rawShouts
      .filter((s) => !this.isHiddenShout(s, hiddenUserIds))
      .map((s) => ({
        shout: s,
        distance: haversineDistance(userLat, userLon, Number(s.latitude), Number(s.longitude)),
      }))
      .sort((a, b) => a.distance - b.distance);

    const paged = withDistance.slice(skip, skip + limit).map((item) => item.shout);

    const transformedShouts = paged.map((shout) => {
      const transformed = this.transformShout(shout, userId);
      if (shout.original_shout) {
        transformed.original_shout = this.transformShout(
          shout.original_shout,
          userId,
        );
      }
      return transformed;
    });

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
        status: true,
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

    const hiddenUserIds = await this.getHiddenUserIds(currentUserId);
    if (hiddenUserIds.has(targetUserId) || user.status === UserStatus.BANNED) {
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
            status: true,
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
        // Include original shout if this shout is a share
        original_shout: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
                status: true,
              },
            },
            medias: true,
            _count: { select: { likes: true, comments: true, shares: true } },
            likes: { where: { user_id: currentUserId }, select: { id: true } },
          },
        },
      },
    });

    const transformedShouts = shouts
      .filter((shout) => !this.isHiddenShout(shout, hiddenUserIds))
      .map((shout) => {
      const transformed = this.transformShout(shout, currentUserId);
      if (shout.original_shout) {
        transformed.original_shout = this.transformShout(
          shout.original_shout,
          currentUserId,
        );
      }
      return transformed;
    });

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
  const hiddenUserIds = await this.getHiddenUserIds(userId);
  const shout = await this.prisma.shout.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          status: true,
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
      original_shout: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
              status: true,
            },
          },
          medias: true,
          _count: { select: { likes: true, comments: true, shares: true } },
          likes: { where: { user_id: userId }, select: { id: true } },
        },
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

  if (this.isHiddenShout(shout, hiddenUserIds)) {
    return {
      success: false,
      statusCode: 404,
      message: 'Shout not found',
    };
  }

  const transformedShout = this.transformShout(shout, userId);

  if (shout.original_shout) {
    transformedShout.original_shout = this.transformShout(shout.original_shout, userId);
  }

  return {
    success: true,
    statusCode: 200,
    data: transformedShout,
  };
}


  async updatePost(
    id: string,
    userId: string,
    updateShoutDto: UpdateShoutDto,
    images?: Express.Multer.File[],
    audio?: Express.Multer.File,
    videos?: Express.Multer.File[],
  ) {
    try {
      const getFileBytes = async (file: Express.Multer.File): Promise<Buffer> => {
        if (file?.buffer && Buffer.isBuffer(file.buffer)) {
          return file.buffer;
        }
        const anyFile = file as any;
        if (anyFile?.path && typeof anyFile.path === 'string') {
          return await readFile(anyFile.path);
        }
        throw new Error('Uploaded file data is missing (no buffer/path)');
      };

      const shout = await this.prisma.shout.findUnique({ where: { id } });

      if (!shout || shout.user_id !== userId) {
        return {
          success: false,
          statusCode: 404,
          message: 'Shout not found or unauthorized',
        };
      }

      // Update basic shout data
      await this.prisma.shout.update({
        where: { id },
        data: {
          content: updateShoutDto.content,
          category: updateShoutDto.category,
          location: updateShoutDto.location,
          latitude: updateShoutDto.latitude,
          longitude: updateShoutDto.longitude,
          is_anonymous: updateShoutDto.is_anonymous,
        },
      });

      // Handle Images - if new images provided, delete old ones and upload new
      if (images && images.length > 0) {
        // Delete existing image media
        await this.prisma.shoutMedia.deleteMany({
          where: { shout_id: id, type: 'IMAGE' },
        });

        // Upload new images
        for (const image of images) {
          const safeName = image.originalname
            .toLowerCase()
            .replace(/[^a-z0-9.\s-_]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
          const fileName = `${StringHelper.randomString()}-${safeName}`;
          const path = `shouts/${id}/images/${fileName}`;

          const bytes = await getFileBytes(image);
          await SazedStorage.put(path, bytes);
          const url = SazedStorage.url(encodeURI(path));

          await this.prisma.shoutMedia.create({
            data: {
              shout_id: id,
              type: 'IMAGE',
              url: url,
            },
          });
        }
      }

      // Handle Audio - if new audio provided, delete old one and upload new
      if (audio) {
        // Delete existing audio media
        await this.prisma.shoutMedia.deleteMany({
          where: { shout_id: id, type: 'AUDIO' },
        });

        // Upload new audio
        const safeName = audio.originalname
          .toLowerCase()
          .replace(/[^a-z0-9.\s-_]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
        const fileName = `${StringHelper.randomString()}-${safeName}`;
        const path = `shouts/${id}/audio/${fileName}`;

        const bytes = await getFileBytes(audio);
        await SazedStorage.put(path, bytes);
        const url = SazedStorage.url(encodeURI(path));

        await this.prisma.shoutMedia.create({
          data: {
            shout_id: id,
            type: 'AUDIO',
            url: url,
            duration: updateShoutDto.audio_duration,
          },
        });
      }

      // Handle Videos - if new videos provided, delete old ones and upload new
      if (videos && videos.length > 0) {
        // Delete existing video media
        await this.prisma.shoutMedia.deleteMany({
          where: { shout_id: id, type: 'VIDEO' },
        });

        // Upload new videos
        for (const video of videos) {
          const safeName = video.originalname
            .toLowerCase()
            .replace(/[^a-z0-9.\s-_]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
          const fileName = `${StringHelper.randomString()}-${safeName}`;
          const path = `shouts/${id}/video/${fileName}`;

          const bytes = await getFileBytes(video);
          await SazedStorage.put(path, bytes);
          const url = SazedStorage.url(encodeURI(path));

          await this.prisma.shoutMedia.create({
            data: {
              shout_id: id,
              type: 'VIDEO',
              url: url,
            },
          });
        }
      }

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

      // 1️⃣ Get top-level comment IDs
      const topLevelComments = await this.prisma.shoutComment.findMany({
        where: { shout_id: id, parent_id: null, deleted_at: null },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        select: { id: true },
      });

      const topLevelIds = topLevelComments.map((c) => c.id);

      if (topLevelIds.length === 0) {
        return {
          success: true,
          statusCode: 200,
          message: 'No comments found',
          data: [],
          total_count: 0,
        };
      }

      // 2️⃣ Fetch all comments for these threads (top-level + all nested)
      const allComments = await this.prisma.shoutComment.findMany({
        where: {
          shout_id: id,
          OR: [{ id: { in: topLevelIds } }, { parent_id: { not: null } }],
          deleted_at: null,
        },
        orderBy: { created_at: 'asc' },
        include: {
          user: {
            select: { id: true, name: true, username: true, avatar: true },
          },
          likes: { where: { user_id: userId }, select: { id: true } },
        },
      });

      // 3️⃣ Normalize comments
      const map = new Map<string, any>();
      const roots: any[] = [];

      allComments.forEach((c) => {
        map.set(c.id, {
          ...c,
          is_liked: c.likes.length > 0,
          likes_count: c.likes.length,
          replies: [],
          replies_count: 0, // will calculate recursively
          likes: undefined,
        });
      });

      // 4️⃣ Build tree and count nested replies recursively
      function calculateReplies(comment) {
        let count = 0;
        for (const child of comment.replies) {
          count += 1 + calculateReplies(child);
        }
        comment.replies_count = count;
        return count;
      }

      // Build tree
      map.forEach((comment) => {
        if (comment.parent_id) {
          const parent = map.get(comment.parent_id);
          if (parent) parent.replies.push(comment);
        } else {
          roots.push(comment);
        }
      });

      // Calculate nested replies count for top-level comments
      roots.forEach(calculateReplies);

      // 5️⃣ Total shout comment count (all top-level + nested)
      const totalCommentCount = roots.reduce(
        (acc, c) => acc + 1 + c.replies_count,
        0,
      );

      return {
        success: true,
        statusCode: 200,
        message: 'Comments fetched',
        total_count: totalCommentCount,
        data: roots.map((c) => ({
          ...c,
          replies: [], // hide replies for now
        })),
      };
    } catch (error) {
      console.error(error);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to fetch comments',
      };
    }
  }

  async getCommentReplies(
    commentId: string,
    userId: string,
    page = 1,
    limit = 10,
  ) {
    try {
      const skip = (page - 1) * limit;

      // Ensure parent comment exists
      const parent = await this.prisma.shoutComment.findUnique({
        where: { id: commentId, deleted_at: null },
        select: { id: true },
      });

      if (!parent) {
        return {
          success: false,
          statusCode: 404,
          message: 'Comment not found',
        };
      }

      const replies = await this.prisma.shoutComment.findMany({
        where: { parent_id: commentId, deleted_at: null },
        skip,
        take: limit,
        orderBy: { created_at: 'asc' },
        include: {
          user: {
            select: { id: true, name: true, username: true, avatar: true },
          },
          likes: { where: { user_id: userId }, select: { id: true } },
          _count: { select: { likes: true, replies: true } },
        },
      });

      const data = replies.map((r) => ({
        id: r.id,
        content: r.content,
        created_at: r.created_at,
        updated_at: r.updated_at,
        deleted_at: r.deleted_at,
        user_id: r.user_id,
        shout_id: r.shout_id,
        parent_id: r.parent_id,
        user: r.user,
        is_liked: r.likes.length > 0,
        likes_count: r._count.likes,
        replies_count: r._count.replies,
        replies: [], // can load nested replies on demand
      }));

      return {
        success: true,
        statusCode: 200,
        message: 'Replies fetched',
        data,
      };
    } catch (error) {
      console.error(error);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to fetch replies',
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

  // async share(id: string, userId: string, createShoutDto: CreateShoutDto) {
  //   // Sharing creates a new shout referencing the original
  //   const originalShout = await this.prisma.shout.findUnique({ where: { id } });
  //   if (!originalShout) {
  //     return {
  //       success: false,
  //       statusCode: 404,
  //       message: 'Original shout not found',
  //     };
  //   }

  //   try {
  //     const shout = await this.prisma.shout.create({
  //       data: {
  //         user_id: userId,
  //         content: createShoutDto.content, // User can add their own text
  //         original_shout_id: id,
  //         is_anonymous: createShoutDto.is_anonymous || false,
  //       },
  //     });

  //     // Notification
  //     try {
  //       if (originalShout.user_id !== userId) {
  //         const sharer = await this.prisma.user.findUnique({
  //           where: { id: userId },
  //           select: { name: true, username: true },
  //         });
  //         const sharerName = sharer?.name || sharer?.username || 'Someone';

  //         await this.notificationService.createNotification({
  //           sender_id: userId,
  //           receiver_id: originalShout.user_id,
  //           text: `${sharerName} shared your shout`,
  //           type: 'message',
  //           entity_id: shout.id,
  //         });
  //       }
  //     } catch (notifError) {
  //       console.error('Error sending share notification:', notifError);
  //     }

  //     const result = await this.getPostById(shout.id, userId);
  //     return {
  //       success: true,
  //       statusCode: 201,
  //       message: 'Shout shared successfully',
  //       shout: result,
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       statusCode: 500,
  //       message: 'Failed to share shout',
  //     };
  //   }
  // }

  async share(id: string, userId: string, createShoutDto: CreateShoutDto) {
    // 1️⃣ Fetch the original shout
    const originalShout = await this.prisma.shout.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, username: true, avatar: true },
        },
        medias: true,
        _count: { select: { likes: true, comments: true, shares: true } },
        likes: { where: { user_id: userId }, select: { id: true } },
      },
    });

    if (!originalShout) {
      return {
        success: false,
        statusCode: 404,
        message: 'Original shout not found',
      };
    }

    try {
      // 2️⃣ Create a new shout for the share
      const sharedShout = await this.prisma.shout.create({
        data: {
          user_id: userId,
          content: createShoutDto.content, // User can add their own text
          original_shout_id: id,
          is_anonymous: createShoutDto.is_anonymous || false,
        },
      });

      // 3️⃣ Send notification to original shout owner
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
            entity_id: sharedShout.id,
          });
        }
      } catch (notifError) {
        console.error('Error sending share notification:', notifError);
      }

      // 4️⃣ Transform original shout for response
      const transformShout = (shout) => ({
        ...shout,
        is_liked: shout.likes.length > 0,
        likes_count: shout._count.likes,
        comments_count: shout._count.comments,
        shares_count: shout._count.shares,
        likes: undefined,
        _count: undefined,
      });

      return {
        success: true,
        statusCode: 201,
        message: 'Shout shared successfully',
        shout: {
          id: sharedShout.id,
          content: sharedShout.content,
          user_id: sharedShout.user_id,
          is_anonymous: sharedShout.is_anonymous,
          created_at: sharedShout.created_at,
          updated_at: sharedShout.updated_at,
          original_shout: transformShout(originalShout), // embed original shout details
        },
      };
    } catch (error) {
      console.error('Error sharing shout:', error);
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
