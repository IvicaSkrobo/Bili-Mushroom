import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import '../../test/tauri-mocks';
import { StagedPhotoViewer } from './StagedPhotoViewer';

// Seed the appStore with a language so useT works
vi.mock('@/stores/appStore', () => ({
  useAppStore: vi.fn((selector: (s: { language: string }) => unknown) =>
    selector({ language: 'en' }),
  ),
}));

const photos = ['/photos/one.jpg', '/photos/two.jpg', '/photos/three.jpg'];

function renderViewer(overrides: Partial<React.ComponentProps<typeof StagedPhotoViewer>> = {}) {
  const onOpenChange = vi.fn();
  const onIndexChange = vi.fn();
  const props: React.ComponentProps<typeof StagedPhotoViewer> = {
    open: true,
    onOpenChange,
    photos,
    currentIndex: 0,
    onIndexChange,
    ...overrides,
  };
  const utils = render(<StagedPhotoViewer {...props} />);
  return { ...utils, onOpenChange, onIndexChange, props };
}

describe('StagedPhotoViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when open is false', () => {
    renderViewer({ open: false });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders nothing when photos is empty', () => {
    renderViewer({ open: true, photos: [] });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders the photo at currentIndex full-size when open', () => {
    renderViewer({ currentIndex: 1 });
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('/photos/two.jpg'));
  });

  it('shows a photo counter when multiple photos are staged', () => {
    renderViewer({ currentIndex: 0 });
    expect(screen.getAllByText('1 / 3').length).toBeGreaterThan(0);
  });

  it('does not show a photo counter with a single photo', () => {
    renderViewer({ photos: ['/photos/one.jpg'], currentIndex: 0 });
    expect(screen.queryByText(/1 \/ 1/)).not.toBeInTheDocument();
  });

  it('calls onIndexChange with next index when next button clicked', () => {
    const { onIndexChange } = renderViewer({ currentIndex: 0 });
    fireEvent.click(screen.getByLabelText('Next'));
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('calls onIndexChange with prev index when prev button clicked', () => {
    const { onIndexChange } = renderViewer({ currentIndex: 1 });
    fireEvent.click(screen.getByLabelText('Previous'));
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it('does not render prev button at index 0', () => {
    renderViewer({ currentIndex: 0 });
    expect(screen.queryByLabelText('Previous')).not.toBeInTheDocument();
  });

  it('does not render next button at the last index', () => {
    renderViewer({ currentIndex: photos.length - 1 });
    expect(screen.queryByLabelText('Next')).not.toBeInTheDocument();
  });

  it('navigates via ArrowRight/ArrowLeft keydown while open', () => {
    const { onIndexChange } = renderViewer({ currentIndex: 1 });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onIndexChange).toHaveBeenCalledWith(2);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it('calls onOpenChange(false) when close button clicked', () => {
    const { onOpenChange } = renderViewer();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('adjusts zoom on wheel, clamped between 1 and 5', () => {
    renderViewer();
    const stage = screen.getByTestId('staged-photo-stage');
    // zoom in repeatedly, should clamp at 5
    for (let i = 0; i < 40; i++) {
      fireEvent.wheel(stage, { deltaY: -100 });
    }
    const img = screen.getByRole('img');
    const transform = img.style.transform;
    const scaleMatch = transform.match(/scale\(([\d.]+)\)/);
    expect(scaleMatch).not.toBeNull();
    expect(Number(scaleMatch![1])).toBeLessThanOrEqual(5);

    // zoom out repeatedly, should clamp at 1
    for (let i = 0; i < 40; i++) {
      fireEvent.wheel(stage, { deltaY: 100 });
    }
    const img2 = screen.getByRole('img');
    const transform2 = img2.style.transform;
    const scaleMatch2 = transform2.match(/scale\(([\d.]+)\)/);
    expect(scaleMatch2).not.toBeNull();
    expect(Number(scaleMatch2![1])).toBeCloseTo(1, 5);
  });

  it('toggles zoom between 1 and 2.5 on double-click', () => {
    renderViewer();
    const stage = screen.getByTestId('staged-photo-stage');
    fireEvent.doubleClick(stage);
    let img = screen.getByRole('img');
    let scaleMatch = img.style.transform.match(/scale\(([\d.]+)\)/);
    expect(Number(scaleMatch![1])).toBeCloseTo(2.5, 5);

    fireEvent.doubleClick(stage);
    img = screen.getByRole('img');
    scaleMatch = img.style.transform.match(/scale\(([\d.]+)\)/);
    expect(Number(scaleMatch![1])).toBeCloseTo(1, 5);
  });

  it('resets zoom to 1 when currentIndex changes', () => {
    const { rerender } = render(
      <StagedPhotoViewer
        open
        onOpenChange={vi.fn()}
        photos={photos}
        currentIndex={0}
        onIndexChange={vi.fn()}
      />,
    );
    const stage = screen.getByTestId('staged-photo-stage');
    fireEvent.doubleClick(stage);
    let img = screen.getByRole('img');
    let scaleMatch = img.style.transform.match(/scale\(([\d.]+)\)/);
    expect(Number(scaleMatch![1])).toBeCloseTo(2.5, 5);

    rerender(
      <StagedPhotoViewer
        open
        onOpenChange={vi.fn()}
        photos={photos}
        currentIndex={1}
        onIndexChange={vi.fn()}
      />,
    );
    img = screen.getByRole('img');
    scaleMatch = img.style.transform.match(/scale\(([\d.]+)\)/);
    expect(Number(scaleMatch![1])).toBeCloseTo(1, 5);
  });

  it('zoom in / zoom out buttons work independently of scroll', () => {
    renderViewer();
    fireEvent.click(screen.getByLabelText('Zoom in'));
    let img = screen.getByRole('img');
    let scaleMatch = img.style.transform.match(/scale\(([\d.]+)\)/);
    expect(Number(scaleMatch![1])).toBeGreaterThan(1);

    fireEvent.click(screen.getByLabelText('Zoom out'));
    img = screen.getByRole('img');
    scaleMatch = img.style.transform.match(/scale\(([\d.]+)\)/);
    expect(Number(scaleMatch![1])).toBeCloseTo(1, 5);
  });
});
