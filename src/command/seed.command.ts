// external imports
import { Command, CommandRunner } from 'nest-commander';
import * as bcrypt from 'bcrypt';
// internal imports
import appConfig from '../config/app.config';
import { StringHelper } from '../common/helper/string.helper';
import { PrismaService } from '../prisma/prisma.service';

@Command({ name: 'seed', description: 'prisma db seed' })
export class SeedCommand extends CommandRunner {
  constructor(private readonly prisma: PrismaService) {
    super();
  }
  async run(passedParam: string[]): Promise<void> {
    await this.seed(passedParam);
  }

  async seed(param: string[]) {
    try {
      console.log(`Prisma Env: ${process.env.PRISMA_ENV}`);
      console.log('Seeding started...');

      // begin transaaction
      await this.prisma.$transaction(async ($tx) => {
        await this.roleSeed();
        await this.permissionSeed();
        await this.userSeed();
        await this.permissionRoleSeed();
      });

      console.log('Seeding done.');
    } catch (error) {
      throw error;
    }
  }

  //---- user section ----
  async userSeed() {
    // system admin, user id: 1
    const systemUserData = appConfig().defaultUser.system;
    const hashedPassword = await bcrypt.hash(
      systemUserData.password,
      appConfig().security.salt,
    );

    const systemUser = await this.prisma.user.upsert({
      where: {
        email: systemUserData.email,
      },
      update: {
        username: systemUserData.username,
        password: hashedPassword,
        type: 'su_admin',
      },
      create: {
        username: systemUserData.username,
        email: systemUserData.email,
        password: hashedPassword,
        type: 'su_admin',
      },
    });

    await this.prisma.roleUser.upsert({
      where: {
        role_id_user_id: {
          role_id: '1',
          user_id: systemUser.id,
        },
      },
      update: {},
      create: {
        user_id: systemUser.id,
        role_id: '1',
      },
    });
  }

  async permissionSeed() {
    let i = 0;
    const permissions = [];
    const permissionGroups = [
      // (system level )super admin level permission
      { title: 'system_tenant_management', subject: 'SystemTenant' },
      // end (system level )super admin level permission
      { title: 'user_management', subject: 'User' },
      { title: 'role_management', subject: 'Role' },
      // Project
      { title: 'Project', subject: 'Project' },
      // Task
      {
        title: 'Task',
        subject: 'Task',
        scope: ['read', 'create', 'update', 'show', 'delete', 'assign'],
      },
      // Comment
      { title: 'Comment', subject: 'Comment' },
    ];

    for (const permissionGroup of permissionGroups) {
      if (permissionGroup['scope']) {
        for (const permission of permissionGroup['scope']) {
          permissions.push({
            id: String(++i),
            title: permissionGroup.title + '_' + permission,
            action: StringHelper.cfirst(permission),
            subject: permissionGroup.subject,
          });
        }
      } else {
        for (const permission of [
          'read',
          'create',
          'update',
          'show',
          'delete',
        ]) {
          permissions.push({
            id: String(++i),
            title: permissionGroup.title + '_' + permission,
            action: StringHelper.cfirst(permission),
            subject: permissionGroup.subject,
          });
        }
      }
    }

    for (const permission of permissions) {
      await this.prisma.permission.upsert({
        where: {
          id: permission.id,
        },
        update: {
          title: permission.title,
          action: permission.action,
          subject: permission.subject,
        },
        create: {
          id: permission.id,
          title: permission.title,
          action: permission.action,
          subject: permission.subject,
        },
      });
    }
  }

  async permissionRoleSeed() {
    const all_permissions = await this.prisma.permission.findMany();
    const su_admin_permissions = all_permissions.filter(function (permission) {
      return permission.title.substring(0, 25) == 'system_tenant_management_';
    });
    // const su_admin_permissions = all_permissions;

    // -----su admin permission---
    const adminPermissionRoleArray = [];
    for (const su_admin_permission of su_admin_permissions) {
      adminPermissionRoleArray.push({
        role_id: '1',
        permission_id: su_admin_permission.id,
      });
    }
    for (const item of adminPermissionRoleArray) {
      await this.prisma.permissionRole.upsert({
        where: {
          permission_id_role_id: {
            permission_id: item.permission_id,
            role_id: item.role_id,
          },
        },
        update: {},
        create: {
          permission_id: item.permission_id,
          role_id: item.role_id,
        },
      });
    }
    // -----------

    // ---admin---
    const project_admin_permissions = all_permissions.filter(
      function (permission) {
        return permission.title.substring(0, 25) != 'system_tenant_management_';
      },
    );

    const projectAdminPermissionRoleArray = [];
    for (const admin_permission of project_admin_permissions) {
      projectAdminPermissionRoleArray.push({
        role_id: '2',
        permission_id: admin_permission.id,
      });
    }
    for (const item of projectAdminPermissionRoleArray) {
      await this.prisma.permissionRole.upsert({
        where: {
          permission_id_role_id: {
            permission_id: item.permission_id,
            role_id: item.role_id,
          },
        },
        update: {},
        create: {
          permission_id: item.permission_id,
          role_id: item.role_id,
        },
      });
    }
    // -----------

    // ---project manager---
    const project_manager_permissions = all_permissions.filter(
      function (permission) {
        return (
          permission.title == 'project_read' ||
          permission.title == 'project_show' ||
          permission.title == 'project_update' ||
          permission.title.substring(0, 4) == 'Task' ||
          permission.title.substring(0, 7) == 'Comment'
        );
      },
    );

    const projectManagerPermissionRoleArray = [];
    for (const project_manager_permission of project_manager_permissions) {
      projectManagerPermissionRoleArray.push({
        role_id: '3',
        permission_id: project_manager_permission.id,
      });
    }
    for (const item of projectManagerPermissionRoleArray) {
      await this.prisma.permissionRole.upsert({
        where: {
          permission_id_role_id: {
            permission_id: item.permission_id,
            role_id: item.role_id,
          },
        },
        update: {},
        create: {
          permission_id: item.permission_id,
          role_id: item.role_id,
        },
      });
    }
    // -----------

    // ---member---
    const member_permissions = all_permissions.filter(function (permission) {
      return (
        permission.title == 'project_read' ||
        permission.title == 'project_show' ||
        permission.title == 'task_read' ||
        permission.title == 'task_show' ||
        permission.title == 'task_update' ||
        permission.title.substring(0, 7) == 'comment'
      );
    });

    const memberPermissionRoleArray = [];
    for (const project_manager_permission of member_permissions) {
      memberPermissionRoleArray.push({
        role_id: '4',
        permission_id: project_manager_permission.id,
      });
    }
    for (const item of memberPermissionRoleArray) {
      await this.prisma.permissionRole.upsert({
        where: {
          permission_id_role_id: {
            permission_id: item.permission_id,
            role_id: item.role_id,
          },
        },
        update: {},
        create: {
          permission_id: item.permission_id,
          role_id: item.role_id,
        },
      });
    }
    // -----------

    // ---viewer---
    const viewer_permissions = all_permissions.filter(function (permission) {
      return (
        permission.title == 'project_read' ||
        permission.title == 'project_show' ||
        permission.title == 'task_read' ||
        permission.title == 'comment_read'
      );
    });

    const viewerPermissionRoleArray = [];
    for (const viewer_permission of viewer_permissions) {
      viewerPermissionRoleArray.push({
        role_id: '5',
        permission_id: viewer_permission.id,
      });
    }
    for (const item of viewerPermissionRoleArray) {
      await this.prisma.permissionRole.upsert({
        where: {
          permission_id_role_id: {
            permission_id: item.permission_id,
            role_id: item.role_id,
          },
        },
        update: {},
        create: {
          permission_id: item.permission_id,
          role_id: item.role_id,
        },
      });
    }
    // -----------
  }

  async roleSeed() {
    const roles = [
      // system role
      {
        id: '1',
        title: 'Super Admin', // system admin, do not assign to a tenant/user
        name: 'su_admin',
      },
      // organization role
      {
        id: '2',
        title: 'Admin',
        name: 'admin',
      },
      {
        id: '3',
        title: 'Project Manager',
        name: 'project_manager',
      },
      {
        id: '4',
        title: 'Member',
        name: 'member',
      },
      {
        id: '5',
        title: 'Viewer',
        name: 'viewer',
      },
    ];

    for (const role of roles) {
      await this.prisma.role.upsert({
        where: {
          id: role.id,
        },
        update: {
          title: role.title,
          name: role.name,
        },
        create: {
          id: role.id,
          title: role.title,
          name: role.name,
        },
      });
    }
  }
}
