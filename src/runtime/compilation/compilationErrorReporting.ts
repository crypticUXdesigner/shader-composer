/**
 * Compilation error reporting via ErrorHandler.
 * Extracted from CompilationManager for smaller module size.
 */

import { ShaderCompilationError } from '../errors';
import { ErrorUtils } from '../../utils/errorHandling';
import type { AppError } from '../../utils/errorHandling';

export type ReportError = (err: AppError) => void;

/**
 * Report compilation errors (from compiler metadata).
 */
export function reportCompilationErrors(errors: string[], reportError: ReportError): void {
  const message = errors.length === 1
    ? errors[0]
    : `Shader compilation failed with ${errors.length} errors`;
  reportError(ErrorUtils.compilationError(message, errors));
}

/**
 * Report a compilation error (exception).
 */
export function reportCompilationError(error: Error, reportError: ReportError): void {
  if (error instanceof ShaderCompilationError) {
    reportCompilationErrors([error.glError], reportError);
  } else {
    const message = `Unexpected compilation error: ${error.message}`;
    reportError(
      ErrorUtils.compilationError(message, undefined, { originalError: error })
    );
  }
}
