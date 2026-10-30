import { Module } from '@nestjs/common';
import { InvitationsController, WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({ controllers: [WorkspacesController, InvitationsController], providers: [WorkspacesService] })
export class WorkspacesModule {}
