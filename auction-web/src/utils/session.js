/**
 * Session Utility
 * Provides helper functions for managing session messages and authentication.
 * Follows DRY principle by centralizing session message handling.
 */

/**
 * Sets a success message in the session.
 * @param {Object} req - Express request object
 * @param {string} message - Success message to display
 */
export function setSuccessMessage(req, message) {
  req.session.success_message = message;
}

/**
 * Sets an error message in the session.
 * @param {Object} req - Express request object
 * @param {string} message - Error message to display
 */
export function setErrorMessage(req, message) {
  req.session.error_message = message;
}

/**
 * Gets and clears success message from session.
 * @param {Object} req - Express request object
 * @returns {string|null} Success message or null
 */
export function getAndClearSuccessMessage(req) {
  const message = req.session.success_message;
  delete req.session.success_message;
  return message || null;
}

/**
 * Gets and clears error message from session.
 * @param {Object} req - Express request object
 * @returns {string|null} Error message or null
 */
export function getAndClearErrorMessage(req) {
  const message = req.session.error_message;
  delete req.session.error_message;
  return message || null;
}

/**
 * Gets success message from query string based on predefined keys.
 * @param {Object} query - Request query object
 * @returns {string|null} Success message or null
 */
export function getSuccessMessageFromQuery(query) {
  if (query.success === "true") {
    return "Profile updated successfully.";
  }
  if (query["send-request-upgrade"] === "true") {
    return "Your upgrade request has been sent successfully.";
  }
  return null;
}

/**
 * Establishes authenticated session for a user.
 * @param {Object} req - Express request object
 * @param {Object} user - User object to store in session
 */
export function establishAuthSession(req, user) {
  req.session.isAuthenticated = true;
  req.session.authUser = user;
}

/**
 * Clears authenticated session.
 * @param {Object} req - Express request object
 */
export function clearAuthSession(req) {
  req.session.isAuthenticated = false;
  delete req.session.authUser;
}

/**
 * Gets and clears return URL from session.
 * @param {Object} req - Express request object
 * @returns {string} Return URL or default '/'
 */
export function getAndClearReturnUrl(req) {
  const returnUrl = req.session.returnUrl || "/";
  delete req.session.returnUrl;
  return returnUrl;
}

/**
 * Middleware that adds helper methods to the request object for setting session messages.
 * Usage: app.use(sessionMessageMiddleware);
 * Then in routes: req.setSuccessMessage('Success!');
 */
export function sessionMessageMiddleware(req, res, next) {
  req.setSuccessMessage = (message) => setSuccessMessage(req, message);
  req.setErrorMessage = (message) => setErrorMessage(req, message);
  next();
}
