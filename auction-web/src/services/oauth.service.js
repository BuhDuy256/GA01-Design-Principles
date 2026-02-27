// services/oauth.service.js
import * as userModel from '../models/user.model.js';

export const OAuthService = {
  /**
   * Resolves a user from an OAuth provider profile.
   * If the user doesn't exist by oauth_id or email, a new user is created.
   * @param {string} provider 'google', 'facebook', 'github', 'twitter'
   * @param {Object} profile The normalized Passport profile object
   * @returns {Object} The resolved user object
   */
  async resolveOAuthUser(provider, profile) {
    // 1. Check if user already linked this OAuth provider
    let user = await userModel.findByOAuthProvider(provider, profile.id);
    if (user) {
      return user;
    }

    // 2. Fallback: Check if user exists by email, if so link the accounts
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    if (email) {
      user = await userModel.findByEmail(email);
      if (user) {
        await userModel.addOAuthProvider(user.id, provider, profile.id);
        return user;
      }
    }

    // 3. User does not exist at all, create a new one
    const displayName = profile.displayName || profile.username || `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`;
    
    const newUser = await userModel.add({
      email: email || `${provider}_${profile.id}@oauth.local`,
      fullname: displayName,
      password_hash: null, // OAuth users don't have local passwords
      address: '',         // Empty by default for OAuth
      role: 'bidder',
      email_verified: true, // OAuth emails are considered verified
      oauth_provider: provider,
      oauth_id: profile.id
    });

    return newUser;
  }
};
