import express from 'express';
import bcrypt from 'bcryptjs';
import passport from '../utils/passport.js';
import { verifyCaptcha } from '../middlewares/verifyCaptcha.js';
import { isAuthenticated } from '../middlewares/auth.mdw.js';
import { AuthService } from '../services/auth.service.js';

const router = express.Router();

// ===================== AUTH ROUTES =====================

// GET /signup
router.get('/signup', function (req, res) {
  res.render('vwAccount/auth/signup', {
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY
  });
});

// POST /signup
router.post('/signup', verifyCaptcha, async function (req, res) {
  const { fullname, email, address, password, confirmPassword } = req.body;
  
  const errors = {};
  const old = { fullname, email, address };

  if (req.captchaErrors && req.captchaErrors.captcha) {
      errors.captcha = req.captchaErrors.captcha;
  }
  
  if (!fullname) errors.fullname = 'Full name is required';
  if (!address) errors.address = 'Address is required';
  if (!email) errors.email = 'Email is required';

  if (!password) errors.password = 'Password is required';
  if (password !== confirmPassword)
    errors.confirmPassword = 'Passwords do not match';

  if (Object.keys(errors).length > 0) {
    return res.render('vwAccount/auth/signup', {
      errors,
      old,
      error_message: 'Please correct the errors below.',
    });
  }

  const verifyUrlBase = `${process.env.APP_BASE_URL}/account/verify-email`;
  const { error } = await AuthService.registerUser({ fullname, email, address, password }, verifyUrlBase);

  if (error) {
    return res.render('vwAccount/auth/signup', {
      errors: error, // Map AuthService error format
      old,
      error_message: 'Please correct the errors below.',
    });
  }

  return res.redirect(
    `/account/verify-email?email=${encodeURIComponent(email)}`
  );
});

// GET /signin
router.get('/signin', function (req, res) {
  const success_message = req.session.success_message;
  delete req.session.success_message;
  res.render('vwAccount/auth/signin', { success_message });
});

// POST /signin
router.post('/signin', async function (req, res) {
  const { email, password } = req.body;

  const { user, error, unverified } = await AuthService.loginWithCredentials(email, password);

  if (error) {
    return res.render('vwAccount/auth/signin', {
      error_message: error,
      old: { email },
    });
  }

  if (unverified) {
    await AuthService.resendVerificationOtp(email);
    return res.redirect(`/account/verify-email?email=${encodeURIComponent(email)}`);
  }

  req.session.isAuthenticated = true;
  req.session.authUser = user;
  const returnUrl = req.session.returnUrl || '/';
  delete req.session.returnUrl;
  return res.redirect(returnUrl);
});

// GET /verify-email
router.get('/verify-email', (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.redirect('/account/signin');
  }

  return res.render('vwAccount/auth/verify-otp', {
    email,
    info_message:
      'We have sent an OTP to your email. Please enter it below to verify your account.',
  });
});

// POST /verify-email
router.post('/verify-email', async (req, res) => {
  const { email, otp } = req.body;

  const { error } = await AuthService.verifyEmailOtp(email, otp);

  if (error) {
    return res.render('vwAccount/auth/verify-otp', {
      email,
      error_message: error,
    });
  }

  req.session.success_message =
    'Your email has been verified. You can sign in now.';
  return res.redirect('/account/signin');
});

// POST /resend-otp
router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;

  const { error, alreadyVerified } = await AuthService.resendVerificationOtp(email);

  if (error) {
    return res.render('vwAccount/auth/verify-otp', {
      email,
      error_message: error,
    });
  }

  if (alreadyVerified) {
    return res.render('vwAccount/auth/signin', {
      success_message: 'Your email is already verified. Please sign in.',
    });
  }

  return res.render('vwAccount/auth/verify-otp', {
    email,
    info_message: 'We have sent a new OTP to your email. Please check your inbox.',
  });
});

// GET /forgot-password
router.get('/forgot-password', (req, res) => {
  res.render('vwAccount/auth/forgot-password');
});

// POST /forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const { error } = await AuthService.processPasswordResetRequest(email, false);
  
  if (error) {
    return res.render('vwAccount/auth/forgot-password', {
      error_message: error,
    });
  }
  
  return res.render('vwAccount/auth/verify-forgot-password-otp', {
    email,
  });
});

// POST /verify-forgot-password-otp
router.post('/verify-forgot-password-otp', async (req, res) => {
    const { email, otp } = req.body;
    console.log('Verifying OTP for email:', email, ' OTP:', otp);
    
    const { error } = await AuthService.verifyPasswordResetOtp(email, otp);
    
    if (error) {
      console.log('Invalid OTP attempt for email:', email);
      return res.render('vwAccount/auth/verify-forgot-password-otp', {
        email,
        error_message: error,
      });
    }
    
    return res.render('vwAccount/auth/reset-password', { email });
});

// POST /resend-forgot-password-otp
router.post('/resend-forgot-password-otp', async (req, res) => {
  const { email } = req.body;
  
  const { error } = await AuthService.processPasswordResetRequest(email, true);
  
  if (error) {
    return res.render('vwAccount/auth/verify-forgot-password-otp', {
      email,
      error_message: error,
    });
  }
  
  return res.render('vwAccount/auth/verify-forgot-password-otp', {
    email,
    info_message: 'We have sent a new OTP to your email. Please check your inbox.',
  });
});

// POST /reset-password
router.post('/reset-password', async (req, res) => {
  const { email, new_password, confirm_new_password } = req.body;
  if (new_password !== confirm_new_password) {
    return res.render('vwAccount/auth/reset-password', {
      email,
      error_message: 'Passwords do not match.',
    });
  }
  
  const { error } = await AuthService.resetPassword(email, new_password);
  
  if (error) {
    return res.render('vwAccount/auth/reset-password', {
      email,
      error_message: error,
    });
  }
  
  return res.render('vwAccount/auth/signin', {
    success_message: 'Your password has been reset. You can sign in now.',
  });
});

// POST /logout
router.post('/logout', isAuthenticated, (req, res) => {
  req.session.isAuthenticated = false;
  delete req.session.authUser;
  res.redirect('/');
});


// ===================== OAUTH ROUTES =====================

// Google OAuth
router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/account/signin' }),
  (req, res) => {
    req.session.authUser = req.user;
    req.session.isAuthenticated = true;
    res.redirect('/');
  }
);

// Facebook OAuth
router.get('/auth/facebook',
  passport.authenticate('facebook', { scope: ['public_profile'] })
);

router.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/account/signin' }),
  (req, res) => {
    req.session.authUser = req.user;
    req.session.isAuthenticated = true;
    res.redirect('/');
  }
);

// GitHub OAuth
router.get('/auth/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

router.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/account/signin' }),
  (req, res) => {
    req.session.authUser = req.user;
    req.session.isAuthenticated = true;
    res.redirect('/');
  }
);

export default router;
