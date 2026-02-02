import { Response } from 'express';

export function ok(res: Response, data?: any, statusCode?: number): Response;
export function fail(res: Response, message?: string, statusCode?: number): Response;
export function unauthorized(res: Response, message?: string): Response;
export function forbidden(res: Response, message?: string): Response;
export function serverError(res: Response, message?: string): Response;