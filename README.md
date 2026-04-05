# Jerry E-Commerce Dashboard

A modern e-commerce dashboard built with Next.js, featuring product management, analytics, and export functionality for different aspect ratios.

## Features

- 📊 **Real-time Analytics Dashboard** - Track revenue, products, and orders
- 🛍️ **Product Management** - Display and manage featured products
- 📸 **Export Functionality** - Download dashboard as PNG in 1:1 or 3:4 aspect ratios
- 🎨 **Modern UI** - Clean, responsive design with Tailwind CSS
- ⚡ **Fast Performance** - Built with Next.js 16 and React 19

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Usage

### Export Dashboard

The dashboard includes export buttons to capture the current state as an image:

1. **Export 1:1 (Square)** - Downloads the dashboard as a square image (1200x1200px)
2. **Export 3:4 (Portrait)** - Downloads the dashboard in portrait format (1200x1600px)

These exports are perfect for:
- Social media sharing
- Presentation slides
- Marketing materials
- Report generation

### Customization

You can customize the dashboard by editing:

- `src/app/page.tsx` - Main dashboard layout and content
- `src/components/ExportButton.tsx` - Export button component
- `tailwind.config.ts` - Styling configuration

## Tech Stack

- **Framework**: Next.js 16
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4
- **Export**: html2canvas
- **Language**: TypeScript

## Project Structure

```
jerry-dashboard/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Main dashboard page
│   │   ├── layout.tsx        # Root layout
│   │   └── globals.css       # Global styles
│   └── components/
│       └── ExportButton.tsx  # Export functionality component
├── public/                   # Static assets
└── package.json
```

## Future Enhancements

- [ ] Add real product images and data
- [ ] Integrate with e-commerce backend
- [ ] Add more export formats (PDF, SVG)
- [ ] Implement data filtering and sorting
- [ ] Add authentication and user management
- [ ] Create dark mode support

## License

This project is open source and available under the MIT License.
