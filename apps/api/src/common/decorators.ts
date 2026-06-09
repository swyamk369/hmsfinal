import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestContext } from './types';

export const PUBLIC_KEY = 'isPublic';
/** Marks a route as not requiring authentication. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

export const PERMISSION_KEY = 'requiredPermission';
/** Requires the caller to hold at least one of the given permission keys. */
export const RequirePermission = (...perms: string[]) => SetMetadata(PERMISSION_KEY, perms);

export const MODULE_KEY = 'requiredModule';
/** Requires the active tenant to have the given module entitlement enabled. */
export const RequireModule = (code: string) => SetMetadata(MODULE_KEY, code);

/** Injects the resolved per-request context. */
export const Ctx = createParamDecorator((_data: unknown, exec: ExecutionContext): RequestContext => {
  return exec.switchToHttp().getRequest().ctx;
});
