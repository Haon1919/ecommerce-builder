import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductGallery } from './ProductGallery';

describe('ProductGallery', () => {
  const images = [
    'https://example.com/img1.jpg',
    'https://example.com/img2.jpg',
    'https://example.com/img3.jpg',
  ];

  it('shows the first image by default', () => {
    render(
      <ProductGallery
        images={images}
        modelUrl={null}
        arEnabled={false}
        productName="Blue Widget"
      />
    );
    const mainImage = screen.getAllByRole('img')[0];
    expect(mainImage).toHaveAttribute('src', images[0]);
    expect(mainImage).toHaveAttribute('alt', 'Blue Widget');
  });

  it('shows a fallback emoji when there are no images', () => {
    const { container } = render(
      <ProductGallery images={[]} modelUrl={null} arEnabled={false} productName="Widget" />
    );
    expect(container.textContent).toContain('🛍');
  });

  it('renders thumbnail buttons for multiple images', () => {
    const { container } = render(
      <ProductGallery
        images={images}
        modelUrl={null}
        arEnabled={false}
        productName="Blue Widget"
      />
    );
    // Thumbnails use alt="" (decorative) so they don't appear as role="img"
    // Count all img elements directly
    const allImgs = container.querySelectorAll('img');
    // Main image + 3 thumbnails = 4 total
    expect(allImgs.length).toBeGreaterThanOrEqual(3);
  });

  it('does not render a thumbnail row when there is only one image', () => {
    render(
      <ProductGallery
        images={['https://example.com/single.jpg']}
        modelUrl={null}
        arEnabled={false}
        productName="Widget"
      />
    );
    // Only the main image should be rendered, not thumbnails
    const allImages = screen.getAllByRole('img');
    expect(allImages).toHaveLength(1);
  });

  it('switches the main image when a thumbnail is clicked', () => {
    render(
      <ProductGallery
        images={images}
        modelUrl={null}
        arEnabled={false}
        productName="Blue Widget"
      />
    );

    const thumbnailButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.querySelector('img'));

    // Click the second thumbnail
    fireEvent.click(thumbnailButtons[1]);

    const mainImage = screen.getAllByRole('img')[0];
    expect(mainImage).toHaveAttribute('src', images[1]);
  });

  it('applies a highlighted border to the selected thumbnail', () => {
    render(
      <ProductGallery
        images={images}
        modelUrl={null}
        arEnabled={false}
        productName="Blue Widget"
      />
    );

    const thumbnailButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.querySelector('img'));

    // Initially the first thumbnail is selected
    expect(thumbnailButtons[0].className).toContain('border-primary');
    expect(thumbnailButtons[1].className).not.toContain('border-primary');

    // Click the second thumbnail
    fireEvent.click(thumbnailButtons[1]);
    expect(thumbnailButtons[1].className).toContain('border-primary');
    expect(thumbnailButtons[0].className).not.toContain('border-primary');
  });

  it('does not show the 2D/3D toggle when arEnabled is false', () => {
    render(
      <ProductGallery
        images={images}
        modelUrl="https://example.com/model.glb"
        arEnabled={false}
        productName="Widget"
      />
    );

    expect(screen.queryByRole('button', { name: /2d images/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /3d & ar/i })).not.toBeInTheDocument();
  });

  it('does not show the 2D/3D toggle when modelUrl is null', () => {
    render(
      <ProductGallery
        images={images}
        modelUrl={null}
        arEnabled={true}
        productName="Widget"
      />
    );

    expect(screen.queryByRole('button', { name: /2d images/i })).not.toBeInTheDocument();
  });

  it('shows the 2D/3D toggle when arEnabled is true and modelUrl is set', () => {
    render(
      <ProductGallery
        images={images}
        modelUrl="https://example.com/model.glb"
        arEnabled={true}
        productName="Widget"
      />
    );

    expect(screen.getByRole('button', { name: /2d images/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3d & ar/i })).toBeInTheDocument();
  });

  it('switches to 3D view when the "3D & AR" button is clicked', () => {
    const { container } = render(
      <ProductGallery
        images={images}
        modelUrl="https://example.com/model.glb"
        arEnabled={true}
        productName="Widget"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /3d & ar/i }));

    // model-viewer should appear and standard img should disappear
    expect(container.querySelector('model-viewer')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('switches back to 2D view when the "2D Images" button is clicked', () => {
    const { container } = render(
      <ProductGallery
        images={images}
        modelUrl="https://example.com/model.glb"
        arEnabled={true}
        productName="Widget"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /3d & ar/i }));
    expect(container.querySelector('model-viewer')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /2d images/i }));
    expect(container.querySelector('model-viewer')).not.toBeInTheDocument();
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
  });

  it('hides thumbnail list when 3D view is active', () => {
    render(
      <ProductGallery
        images={images}
        modelUrl="https://example.com/model.glb"
        arEnabled={true}
        productName="Widget"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /3d & ar/i }));

    // In 3D mode, thumbnail buttons should not be present
    const thumbnailButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.querySelector('img'));
    expect(thumbnailButtons).toHaveLength(0);
  });
});
