import React, { useState } from 'react';

export function ProfileAvatar({ url, children }) {
  const [failed, setFailed] = useState(null);
  return url && failed !== url
    ? <img className="profile-avatar-image" src={url} alt="" decoding="async" onError={() => setFailed(url)} />
    : children;
}
