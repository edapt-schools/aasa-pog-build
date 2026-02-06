/**
 * Base API Error class
 */
export class ApiError extends Error {
    statusCode;
    code;
    details;
    constructor(message, statusCode, code, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = 'ApiError';
    }
}
/**
 * Unauthorized error (401)
 * User needs to log in or session expired
 */
export class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized - please log in') {
        super(message, 401, 'UNAUTHORIZED');
        this.name = 'UnauthorizedError';
    }
}
/**
 * Forbidden error (403)
 * User doesn't have permission
 */
export class ForbiddenError extends ApiError {
    constructor(message = 'Forbidden - insufficient permissions') {
        super(message, 403, 'FORBIDDEN');
        this.name = 'ForbiddenError';
    }
}
/**
 * Not Found error (404)
 * Resource doesn't exist
 */
export class NotFoundError extends ApiError {
    constructor(message = 'Resource not found') {
        super(message, 404, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}
/**
 * Validation error (400)
 * Invalid request data
 */
export class ValidationError extends ApiError {
    validationErrors;
    constructor(message = 'Validation error', validationErrors) {
        super(message, 400, 'VALIDATION_ERROR', validationErrors);
        this.validationErrors = validationErrors;
        this.name = 'ValidationError';
    }
}
/**
 * Server error (500)
 * Internal server error
 */
export class ServerError extends ApiError {
    constructor(message = 'Internal server error') {
        super(message, 500, 'SERVER_ERROR');
        this.name = 'ServerError';
    }
}
/**
 * Network error
 * Failed to connect to server
 */
export class NetworkError extends ApiError {
    constructor(message = 'Network error - please check your connection') {
        super(message, 0, 'NETWORK_ERROR');
        this.name = 'NetworkError';
    }
}
/**
 * Parse error response from API
 */
export async function parseErrorResponse(response) {
    try {
        const data = await response.json();
        const message = data.error || data.message || response.statusText;
        switch (response.status) {
            case 401:
                return new UnauthorizedError(message);
            case 403:
                return new ForbiddenError(message);
            case 404:
                return new NotFoundError(message);
            case 400:
                return new ValidationError(message, data.errors);
            case 500:
            case 502:
            case 503:
            case 504:
                return new ServerError(message);
            default:
                return new ApiError(message, response.status, data.code, data.details);
        }
    }
    catch {
        // If response is not JSON, use status text
        return new ApiError(response.statusText, response.status);
    }
}
/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error) {
    if (error instanceof UnauthorizedError) {
        return 'Your session has expired. Please log in again.';
    }
    if (error instanceof ForbiddenError) {
        return "You don't have permission to perform this action.";
    }
    if (error instanceof NotFoundError) {
        return 'The requested resource was not found.';
    }
    if (error instanceof ValidationError) {
        return error.message;
    }
    if (error instanceof ServerError) {
        return 'Something went wrong on our end. Please try again later.';
    }
    if (error instanceof NetworkError) {
        return 'Unable to connect to the server. Please check your internet connection.';
    }
    if (error instanceof ApiError) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unexpected error occurred. Please try again.';
}
