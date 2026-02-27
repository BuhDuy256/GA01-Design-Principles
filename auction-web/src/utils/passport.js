import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as TwitterStrategy } from 'passport-twitter';
import { Strategy as GitHubStrategy } from 'passport-github2';
import * as userModel from '../models/user.model.js';
import { OAuthService } from '../services/oauth.service.js';

// Serialize user vào session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user từ session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await userModel.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// ===================== GOOGLE STRATEGY =====================
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3005/account/auth/google/callback'
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const user = await OAuthService.resolveOAuthUser('google', profile);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
}));

// ===================== FACEBOOK STRATEGY =====================
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3005/account/auth/facebook/callback',
  profileFields: ['id', 'displayName', 'name', 'emails'],
  enableProof: true
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const user = await OAuthService.resolveOAuthUser('facebook', profile);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
}));

// ===================== TWITTER STRATEGY =====================
// DISABLED: Twitter API requires paid subscription ($100/month) for OAuth
// Free tier does not support OAuth since February 2023
/*
passport.use(new TwitterStrategy({
  consumerKey: process.env.TWITTER_CONSUMER_KEY,
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  callbackURL: process.env.TWITTER_CALLBACK_URL || 'http://localhost:3005/account/auth/twitter/callback',
  includeEmail: true
},
async (token, tokenSecret, profile, done) => {
  try {
    const user = await OAuthService.resolveOAuthUser('twitter', profile);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
}));
*/

// ===================== GITHUB STRATEGY =====================
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3005/account/auth/github/callback'
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const user = await OAuthService.resolveOAuthUser('github', profile);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
}));

export default passport;
