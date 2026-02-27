// middlewares/verifyCaptcha.js

/**
 * Middleware to verify Google reCAPTCHA
 */
export async function verifyCaptcha(req, res, next) {
  // BẮT ĐẦU XỬ LÝ RECAPTCHA
  const recaptchaResponse = req.body['g-recaptcha-response'];
  req.captchaErrors = {}; 

  if (!recaptchaResponse) {
    req.captchaErrors.captcha = 'Please check the captcha box.';
    return next();
  }

  // Gọi Google API để verify
  const secretKey = process.env.RECAPTCHA_SECRET; // Make sure this matches the env var name
  const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaResponse}`;
  
  try {
    const response = await fetch(verifyUrl, { method: 'POST' });
    const data = await response.json();
    
    // data.success trả về true nếu verify thành công
    if (!data.success) {
      req.captchaErrors.captcha = 'Captcha verification failed. Please try again.';
    }
  } catch (err) {
    console.error('Recaptcha error:', err);
    req.captchaErrors.captcha = 'Error connecting to captcha server.';
  }
  // KẾT THÚC XỬ LÝ RECAPTCHA

  next();
}
