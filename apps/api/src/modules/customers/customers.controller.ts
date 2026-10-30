import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  createCustomerSchema,
  customerListQuerySchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type CustomerListQuery,
  type UpdateCustomerInput,
} from '@crm/shared';
import { RequireFeature, RequirePermissions, Workspace } from '../../common/decorators';
import { AppException } from '../../common/errors';
import type { WorkspaceContext } from '../../common/types';
import { ZBody, ZQuery } from '../../common/zod';
import { WorkspaceGuard } from '../workspaces/workspace.guard';
import { MAX_IMPORT_BYTES } from './customer-csv';
import { CustomersService } from './customers.service';

const CSV_MIME_TYPES = new Set(['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/csv']);

@ApiTags('Customers')
@UseGuards(WorkspaceGuard)
@RequirePermissions('records:read')
@Controller('workspaces/:workspaceId/customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@Workspace() ctx: WorkspaceContext, @ZQuery(customerListQuerySchema) query: CustomerListQuery) {
    return this.customers.list(ctx, query);
  }

  @Get('export')
  @RequirePermissions('records:export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="customers.csv"')
  export(@Workspace() ctx: WorkspaceContext, @ZQuery(customerListQuerySchema) query: CustomerListQuery) {
    return this.customers.exportCsv(ctx, query);
  }

  @Post('import')
  @HttpCode(200)
  @RequirePermissions('records:import')
  @RequireFeature('csv_import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_BYTES, files: 1 } }))
  import(@Workspace() ctx: WorkspaceContext, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw AppException.badRequest('FILE_REQUIRED', 'Attach a CSV file in the "file" field.');
    const extensionOk = /\.csv$/i.test(file.originalname);
    if (!extensionOk || !CSV_MIME_TYPES.has(file.mimetype)) {
      throw AppException.badRequest('INVALID_FILE_TYPE', 'Only .csv files can be imported.');
    }
    const content = file.buffer.toString('utf8');
    if (content.includes('\u0000')) throw AppException.badRequest('INVALID_FILE_TYPE', 'The file does not look like a text CSV file.');
    return this.customers.importCsv(ctx, content);
  }

  @Get('duplicates')
  duplicates(@Workspace() ctx: WorkspaceContext) {
    return this.customers.duplicates(ctx);
  }

  @Get(':id')
  get(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.get(ctx, id);
  }

  @Post()
  @RequirePermissions('records:create')
  create(@Workspace() ctx: WorkspaceContext, @ZBody(createCustomerSchema) body: CreateCustomerInput) {
    return this.customers.create(ctx, body);
  }

  @Patch(':id')
  @RequirePermissions('records:update_own')
  update(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string, @ZBody(updateCustomerSchema) body: UpdateCustomerInput) {
    return this.customers.update(ctx, id, body);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @RequirePermissions('records:update_own')
  archive(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.setArchived(ctx, id, true);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @RequirePermissions('records:update_own')
  restore(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.setArchived(ctx, id, false);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('records:delete_any')
  async remove(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.customers.remove(ctx, id);
  }
}
