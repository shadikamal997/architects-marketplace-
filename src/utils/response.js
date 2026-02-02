/**
 * Standard API Response Utilities
 * 
 * All endpoints must use these helpers to ensure consistent response format:
 * Success: { success: true, data: ... }
 * Error: { success: false, error: "message" }
 */

/**
 * Send a successful response
 * @param {Object} res - Express response object
 * @param {*} data - Data to return (can be null, array, object, etc.)
 * @param {number} statusCode - HTTP status code (default: 200)
 */
function ok(res, data = null, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

/**
 * Send a failed response (logical error, not auth/server error)
 * @param {Object} res - Express response object
 * @param {string} message - Human-readable error message
 * @param {number} statusCode - HTTP status code (default: 400)
 */
function fail(res, message = 'Operation failed', statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    error: message,
  });
}

/**
 * Send an unauthorized response (401)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
function unauthorized(res, message = 'Unauthorized') {
  return res.status(401).json({
    success: false,
    error: message,
  });
}

/**
 * Send a forbidden response (403)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
function forbidden(res, message = 'Access denied') {
  return res.status(403).json({
    success: false,
    error: message,
  });
}

/**
 * Send a server error response (500)
 * @param {Object} res - Express response object
 * @param {string} message - Error message (no stack traces)
 */
function serverError(res, message = 'Internal server error') {
  return res.status(500).json({
    success: false,
    error: message,
  });
}

module.exports = {
  ok,
  fail,
  unauthorized,
  forbidden,
  serverError,
};
