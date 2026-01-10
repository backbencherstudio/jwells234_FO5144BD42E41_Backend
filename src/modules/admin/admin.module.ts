import { Module } from '@nestjs/common';
import { FaqModule } from './faq/faq.module';
import { ContactModule } from './contact/contact.module';
import { PaymentTransactionModule } from './payment-transaction/payment-transaction.module';
import { UserModule } from './user/user.module';
import { NotificationModule } from './notification/notification.module';
import { ShoutManageModule } from './shout_manage/shout_manage.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    FaqModule,
    ContactModule,
    PaymentTransactionModule,
    UserModule,
    NotificationModule,
    ShoutManageModule,
    ReportsModule,
    DashboardModule,
  ],
})
export class AdminModule {}
