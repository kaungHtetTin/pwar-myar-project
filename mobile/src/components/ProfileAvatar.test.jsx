import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ProfileAvatar } from './ProfileAvatar';

it('shows initials for absent/broken photos and loads a replacement URL', () => {
  const view = url => <ProfileAvatar url={url}>AM</ProfileAvatar>;
  const { container, rerender } = render(view(null));
  expect(container).toHaveTextContent('AM');
  rerender(view('/avatars/first.jpg'));
  expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/first.jpg');
  fireEvent.error(container.querySelector('img'));
  expect(container.querySelector('img')).toBeNull();
  expect(container).toHaveTextContent('AM');
  rerender(view('/avatars/replacement.jpg'));
  expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/replacement.jpg');
});
