"use client";

import { useState } from "react";
import { EyeOffIcon, ViewIcon } from "@/components/icons";

/** A password <input> with a show/hide toggle -- used on login and reset-password
 * (new password + confirm password) so a typo isn't just a wall of dots with no way
 * to check it before submitting. */
export default function PasswordField({
  value,
  onChange,
  required,
  minLength,
  autoFocus,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
  autoFocus?: boolean;
  label: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="afs-auth-field">
      <label>{label}</label>
      <div className="afs-password-field-wrap">
        <input
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="afs-password-field-toggle"
          title={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <EyeOffIcon /> : <ViewIcon />}
        </button>
      </div>
    </div>
  );
}
