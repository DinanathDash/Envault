interface EmailAction {
  text: string;
  url: string;
}

interface EmailProps {
  previewText?: string;
  heading: string;
  content: string; // HTML string
  action?: EmailAction;
  footerText?: string; // Additional text below the button or main content
  logoUrl?: string;
}

// Logo URL
const DEFAULT_APP_URL = (
  process.env.EMAIL_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://www.envault.tech"
).replace(/\/+$/, "");
const DEFAULT_LOGO_URL = `${DEFAULT_APP_URL}/email-logo.png`;

/**
 * Generates a responsive, styled HTML email string.
 */
export function getEmailHtml({
  previewText,
  heading,
  content,
  action,
  footerText,
  logoUrl,
}: EmailProps): string {
  // Brand Colors based on Envault's theme
  const primaryColor = "#18181b"; // Zinc-900
  const backgroundColor = "#f4f4f5"; // Zinc-100
  const cardColor = "#ffffff";
  const textColor = "#18181b";
  const mutedColor = "#52525b"; // Zinc-600
  const borderColor = "#e4e4e7"; // Zinc-200
  const logo = logoUrl || DEFAULT_LOGO_URL;

  // Pre-header/Preview Text hidden element style
  const hiddenStyle =
    "display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <meta name="x-apple-disable-message-reformatting">
  <title>${heading}</title>
  <style>
    /* Reset */
    body { 
      margin: 0; 
      padding: 0; 
      background-color: ${backgroundColor}; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
      -webkit-font-smoothing: antialiased; 
      color: ${textColor};
    }
    
    table { border-spacing: 0; width: 100%; }
    td { padding: 0; }
    img { border: 0; }
    a { color: inherit; }
    
    /* Layout */
    .wrapper { 
      width: 100%; 
      table-layout: fixed; 
      background-color: ${backgroundColor}; 
      padding: 60px 0; 
    }
    
    .main { 
      background-color: ${cardColor}; 
      margin: 0 auto; 
      width: 96%; 
      max-width: 560px; 
      border-radius: 16px; 
      overflow: hidden; 
      box-shadow: 0 4px 20px -1px rgba(0, 0, 0, 0.08);
      border: 1px solid ${borderColor};
    }
    
    /* Elements */
    .header { 
      padding: 36px 40px 26px; 
      text-align: center; 
    }
    
    .logo { 
      color: ${textColor}; 
      text-decoration: none; 
      display: inline-block;
      line-height: 0;
      color: ${textColor} !important;
      text-decoration: none !important;
    }

    .logo img {
      display: block;
      width: 214px;
      max-width: 100%;
      height: auto;
    }

    .logo,
    .logo:visited,
    .logo:hover,
    .logo:active {
      color: ${textColor} !important;
      text-decoration: none !important;
    }

    @media (prefers-color-scheme: dark) {
      .logo {
        color: #ffffff !important;
      }
    }

    [data-ogsc] .logo {
      color: #ffffff !important;
    }
    
    .body { 
      padding: 0 40px 44px; 
    }
    
    .heading { 
      font-size: 24px; 
      font-weight: 600; 
      margin: 0 0 20px; 
      color: ${textColor}; 
      line-height: 1.3; 
      letter-spacing: -0.5px; 
      text-align: left;
    }
    
    .text { 
      font-size: 16px; 
      line-height: 1.6; 
      color: ${mutedColor}; 
      margin: 0 0 24px; 
      text-align: left;
    }

    .text p {
      margin: 0 0 18px;
    }

    .text p:last-child {
      margin-bottom: 0;
    }

    .text strong {
      color: ${textColor};
      font-weight: 600;
    }
    
    .btn-container {
      margin: 32px 0;
      text-align: left;
    }
    
    .btn { 
      display: inline-block; 
      background-color: ${primaryColor}; 
      color: #ffffff !important; 
      font-size: 15px; 
      font-weight: 500; 
      text-decoration: none; 
      padding: 14px 28px; 
      border-radius: 10px; 
      transition: opacity 0.2s;
      text-align: center;
    }
    
    .btn:hover { opacity: 0.9; }
    
    .footer { 
      padding: 32px 48px; 
      text-align: center; 
      background-color: #fafafa; 
      border-top: 1px solid ${borderColor}; 
    }
    
    .footer-text { 
      font-size: 13px; 
      color: #a1a1aa; 
      line-height: 1.6; 
      margin: 0; 
    }
    
    .footer-link {
        color: #a1a1aa;
        text-decoration: underline;
    }
    
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .wrapper { padding: 20px 0; }
      .header { padding: 30px 24px 22px; }
      .body { padding: 0 24px 32px; }
      .footer { padding: 24px; }
      .heading { font-size: 22px; }
      .text { font-size: 15px; }
      .btn { width: 100%; box-sizing: border-box; }
    }
  </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${backgroundColor}; color: ${textColor}; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
  ${previewText ? `<div style="${hiddenStyle}">${previewText}</div>` : ""}
  <div class="wrapper">
    <table role="presentation">
      <tr>
        <td align="center">
          <div class="main">
            <div class="header">
              <a href="${DEFAULT_APP_URL}" class="logo" style="color: ${textColor} !important; text-decoration: none !important;">
                <img
                  src="${logo}"
                  alt="Envault"
                  width="214"
                  height="78"
                  style="display: block; width: 214px; height: auto; max-width: 100%;"
                >
              </a>
            </div>
            <div class="body">
              <h1 class="heading">${heading}</h1>
              <div class="text">${content}</div>
              ${action ? `<div class="btn-container"><a href="${action.url}" class="btn">${action.text}</a></div>` : ""}
              ${footerText ? `<div class="text" style="font-size: 14px; margin-top: 24px; color: #71717a;">${footerText}</div>` : ""}
            </div>
            <div class="footer">
              <p class="footer-text">
                &copy; ${new Date().getFullYear()} Envault. All rights reserved.<br>
                Secure Environment Variables Management
              </p>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `.trim();
}
