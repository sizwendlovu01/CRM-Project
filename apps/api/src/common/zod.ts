import { Body, PipeTransform, Query } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { z, ZodError, type ZodType } from 'zod';
import { AppException } from './errors';

export function zodErrorDetails(error: ZodError) {
  return error.issues.map((issue) => ({ path: issue.path.join('.') || '(root)', message: issue.message }));
}

export class ZodValidationPipe<T extends ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw AppException.badRequest('VALIDATION_FAILED', 'Validation failed', zodErrorDetails(result.error));
    }
    return result.data;
  }
}

/** Best-effort JSON schema for OpenAPI. Never throws: documentation must not break the API. */
function jsonSchemaFor(schema: ZodType): Record<string, unknown> {
  try {
    return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
  } catch {
    return { type: 'object' };
  }
}

function methodDescriptor(target: object, key: string | symbol | undefined): PropertyDescriptor | undefined {
  return key === undefined ? undefined : Object.getOwnPropertyDescriptor(target, key);
}

/** Validates the request body against a Zod schema and documents it in OpenAPI. */
export function ZBody(schema: ZodType): ParameterDecorator {
  return (target, key, index) => {
    Body(new ZodValidationPipe(schema))(target, key as string, index);
    const descriptor = methodDescriptor(target, key);
    if (descriptor && key !== undefined) ApiBody({ schema: jsonSchemaFor(schema) })(target, key, descriptor);
  };
}

/** Validates query parameters against a Zod object schema and documents each property. */
export function ZQuery(schema: ZodType): ParameterDecorator {
  return (target, key, index) => {
    Query(new ZodValidationPipe(schema))(target, key as string, index);
    const descriptor = methodDescriptor(target, key);
    if (!descriptor || key === undefined) return;
    const json = jsonSchemaFor(schema) as { properties?: Record<string, Record<string, unknown>>; required?: string[] };
    for (const [name, property] of Object.entries(json.properties ?? {})) {
      ApiQuery({ name, required: json.required?.includes(name) ?? false, schema: property })(target, key, descriptor);
    }
  };
}

/** Validates an optional UUID query parameter, returning undefined when absent. */
export function optionalUuid(value: unknown, field: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  const result = z.string().uuid().safeParse(value);
  if (!result.success) throw AppException.badRequest('VALIDATION_FAILED', `Invalid ${field}`, [{ path: field, message: 'Must be a UUID' }]);
  return result.data;
}
