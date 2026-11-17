import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ImportEndlessFooter } from './ImportEndlessFooter';

afterEach(() => vi.unstubAllGlobals());

it('automatically loads near the modal bottom without IntersectionObserver', () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  const loaded = vi.fn();
  function Review() {
    const [count, setCount] = useState(20);
    return <div className="mkpos-modal-body" data-testid="scroll-root"><ImportEndlessFooter count={count} total={40} onLoad={() => { loaded(); setCount(40); }} /></div>;
  }
  render(<Review />);
  const root = screen.getByTestId('scroll-root');
  Object.defineProperties(root, { clientHeight: { value: 100 }, scrollHeight: { value: 500 }, scrollTop: { value: 400 } });
  fireEvent.scroll(root);
  expect(screen.getByText('40 of 40 rows · All loaded')).toBeInTheDocument();
  fireEvent.scroll(root);
  expect(loaded).toHaveBeenCalledOnce();
});
