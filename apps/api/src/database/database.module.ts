import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { WorkspaceRefsService } from './workspace-refs.service';

@Global()
@Module({
  providers: [PrismaService, WorkspaceRefsService],
  exports: [PrismaService, WorkspaceRefsService],
})
export class DatabaseModule {}
