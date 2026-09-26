import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedRequest } from './useDebouncedRequest';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedRequest', () => {
  it('does not call fn before the delay elapses', () => {
    const fn = vi.fn().mockResolvedValue('result');
    renderHook(() => useDebouncedRequest('a', 400, fn));
    expect(fn).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(399));
    expect(fn).not.toHaveBeenCalled();
  });

  it('calls fn once the delay elapses and reports the result', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    const { result } = renderHook(() => useDebouncedRequest('a', 400, fn));
    act(() => vi.advanceTimersByTime(400));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a', expect.any(AbortSignal));

    vi.useRealTimers();
    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.data).toBe('result');
  });

  it('restarts the debounce timer on a new input before it fires (cancels the stale timer)', () => {
    const fn = vi.fn().mockResolvedValue('result');
    const { rerender } = renderHook(({ input }) => useDebouncedRequest(input, 400, fn), {
      initialProps: { input: 'a' },
    });
    act(() => vi.advanceTimersByTime(300));
    rerender({ input: 'b' });
    act(() => vi.advanceTimersByTime(300));
    expect(fn).not.toHaveBeenCalled(); // the 'a' timer never reached 400ms
    act(() => vi.advanceTimersByTime(100));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b', expect.any(AbortSignal));
  });

  it('discards a stale response that resolves after a newer request already won', async () => {
    let resolveFirst!: (v: string) => void;
    let resolveSecond!: (v: string) => void;
    const fn = vi
      .fn()
      .mockImplementationOnce(() => new Promise<string>((r) => (resolveFirst = r)))
      .mockImplementationOnce(() => new Promise<string>((r) => (resolveSecond = r)));

    const { result, rerender } = renderHook(({ input }) => useDebouncedRequest(input, 400, fn), {
      initialProps: { input: 'a' },
    });
    act(() => vi.advanceTimersByTime(400));
    rerender({ input: 'b' });
    act(() => vi.advanceTimersByTime(400));
    expect(fn).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
    // Second (newer) request resolves first.
    await act(async () => {
      resolveSecond('second');
    });
    await waitFor(() => expect(result.current.data).toBe('second'));

    // The stale first request resolving afterward must not overwrite it.
    await act(async () => {
      resolveFirst('first');
    });
    expect(result.current.data).toBe('second');
  });

  it('null input skips the request entirely', () => {
    const fn = vi.fn().mockResolvedValue('result');
    renderHook(() => useDebouncedRequest<string, string>(null, 400, fn));
    act(() => vi.advanceTimersByTime(1000));
    expect(fn).not.toHaveBeenCalled();
  });

  it('retry re-runs immediately with the last input, bypassing the debounce', () => {
    const fn = vi.fn().mockResolvedValue('result');
    const { result } = renderHook(() => useDebouncedRequest('a', 400, fn));
    act(() => vi.advanceTimersByTime(400));
    expect(fn).toHaveBeenCalledTimes(1);
    act(() => result.current.retry());
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
