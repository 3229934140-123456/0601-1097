import { BaseEventEmitter } from '../utils/events';
import { generateId } from '../utils/id';
import {
  CoverTemplate,
  CoverConfig,
  VideoOrientation,
} from '../types';

interface CoverGeneratorEvents {
  coverGenerated: { coverId: string; imagePath: string; config: CoverConfig };
  templateSelected: CoverTemplate;
  error: Error;
}

export class CoverGenerator extends BaseEventEmitter<CoverGeneratorEvents> {
  private templates: CoverTemplate[] = [];
  private defaultTemplates: CoverTemplate[] = [
    {
      id: 'portrait-simple',
      name: '简约竖屏',
      orientation: 'portrait',
      thumbnailUrl: 'templates/portrait-simple.jpg',
      layout: 'image-title',
    },
    {
      id: 'portrait-comparison',
      name: '对比竖屏',
      orientation: 'portrait',
      thumbnailUrl: 'templates/portrait-comparison.jpg',
      layout: 'comparison',
    },
    {
      id: 'portrait-stats',
      name: '数据竖屏',
      orientation: 'portrait',
      thumbnailUrl: 'templates/portrait-stats.jpg',
      layout: 'image-title-subtitle',
    },
    {
      id: 'landscape-simple',
      name: '简约横屏',
      orientation: 'landscape',
      thumbnailUrl: 'templates/landscape-simple.jpg',
      layout: 'image-title',
    },
    {
      id: 'landscape-comparison',
      name: '对比横屏',
      orientation: 'landscape',
      thumbnailUrl: 'templates/landscape-comparison.jpg',
      layout: 'comparison',
    },
  ];

  constructor() {
    super();
    this.templates = [...this.defaultTemplates];
  }

  getTemplates(orientation?: VideoOrientation): CoverTemplate[] {
    if (orientation) {
      return this.templates.filter(t => t.orientation === orientation);
    }
    return [...this.templates];
  }

  getTemplate(templateId: string): CoverTemplate | undefined {
    return this.templates.find(t => t.id === templateId);
  }

  addTemplate(template: Omit<CoverTemplate, 'id'>): CoverTemplate {
    const newTemplate: CoverTemplate = {
      ...template,
      id: generateId(),
    };
    this.templates.push(newTemplate);
    return newTemplate;
  }

  removeTemplate(templateId: string): boolean {
    const index = this.templates.findIndex(t => t.id === templateId);
    if (index !== -1) {
      this.templates.splice(index, 1);
      return true;
    }
    return false;
  }

  selectTemplate(templateId: string): CoverTemplate {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    this.emit('templateSelected', template);
    return template;
  }

  async generateCover(config: CoverConfig): Promise<string> {
    const template = this.getTemplate(config.templateId);
    if (!template) {
      throw new Error(`Template not found: ${config.templateId}`);
    }

    return new Promise((resolve, reject) => {
      try {
        const canvas = this.createCanvas(template.orientation);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        this.renderCover(ctx, config, template, canvas.width, canvas.height);

        const imagePath = `cover_${generateId()}.png`;
        this.emit('coverGenerated', { coverId: generateId(), imagePath, config });
        resolve(imagePath);
      } catch (error) {
        this.emit('error', error as Error);
        reject(error);
      }
    });
  }

  renderCoverToCanvas(
    ctx: CanvasRenderingContext2D,
    config: CoverConfig,
    width: number,
    height: number
  ): void {
    const template = this.getTemplate(config.templateId);
    if (!template) {
      throw new Error(`Template not found: ${config.templateId}`);
    }

    this.renderCover(ctx, config, template, width, height);
  }

  private createCanvas(orientation: VideoOrientation): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    if (orientation === 'portrait') {
      canvas.width = 1080;
      canvas.height = 1920;
    } else {
      canvas.width = 1920;
      canvas.height = 1080;
    }
    return canvas;
  }

  private renderCover(
    ctx: CanvasRenderingContext2D,
    config: CoverConfig,
    template: CoverTemplate,
    width: number,
    height: number
  ): void {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    switch (template.layout) {
      case 'image-only':
        this.renderImageOnlyLayout(ctx, config, width, height);
        break;
      case 'image-title':
        this.renderImageTitleLayout(ctx, config, width, height);
        break;
      case 'image-title-subtitle':
        this.renderImageTitleSubtitleLayout(ctx, config, width, height);
        break;
      case 'comparison':
        this.renderComparisonLayout(ctx, config, width, height);
        break;
    }

    if (config.includeTrainingStats && config.trainingCount) {
      this.renderTrainingStats(ctx, config.trainingCount, width, height);
    }
  }

  private renderImageOnlyLayout(
    ctx: CanvasRenderingContext2D,
    config: CoverConfig,
    width: number,
    height: number
  ): void {
    if (config.imagePath) {
      this.drawCoverImage(ctx, config.imagePath, 0, 0, width, height);
    }

    const gradient = ctx.createLinearGradient(0, height * 0.6, 0, height);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, height * 0.6, width, height * 0.4);
  }

  private renderImageTitleLayout(
    ctx: CanvasRenderingContext2D,
    config: CoverConfig,
    width: number,
    height: number
  ): void {
    this.renderImageOnlyLayout(ctx, config, width, height);

    if (config.title) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 72px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      
      const titleY = height - 200;
      this.wrapText(ctx, config.title, width / 2, titleY, width - 100, 80);
    }
  }

  private renderImageTitleSubtitleLayout(
    ctx: CanvasRenderingContext2D,
    config: CoverConfig,
    width: number,
    height: number
  ): void {
    this.renderImageTitleLayout(ctx, config, width, height);

    if (config.subtitle) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '36px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      const subtitleY = height - 180;
      ctx.fillText(config.subtitle, width / 2, subtitleY);
    }
  }

  private renderComparisonLayout(
    ctx: CanvasRenderingContext2D,
    config: CoverConfig,
    width: number,
    height: number
  ): void {
    const isPortrait = height > width;
    const half = isPortrait ? height / 2 : width / 2;

    if (config.beforeImagePath) {
      if (isPortrait) {
        this.drawCoverImage(ctx, config.beforeImagePath, 0, 0, width, half);
      } else {
        this.drawCoverImage(ctx, config.beforeImagePath, 0, 0, half, height);
      }
    } else {
      ctx.fillStyle = '#2d2d44';
      if (isPortrait) {
        ctx.fillRect(0, 0, width, half);
      } else {
        ctx.fillRect(0, 0, half, height);
      }
    }

    if (config.afterImagePath) {
      if (isPortrait) {
        this.drawCoverImage(ctx, config.afterImagePath, 0, half, width, half);
      } else {
        this.drawCoverImage(ctx, config.afterImagePath, half, 0, half, height);
      }
    } else {
      ctx.fillStyle = '#3d3d54';
      if (isPortrait) {
        ctx.fillRect(0, half, width, half);
      } else {
        ctx.fillRect(half, 0, half, height);
      }
    }

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (isPortrait) {
      ctx.moveTo(0, half);
      ctx.lineTo(width, half);
    } else {
      ctx.moveTo(half, 0);
      ctx.lineTo(half, height);
    }
    ctx.stroke();

    ctx.fillStyle = '#f44336';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    if (isPortrait) {
      ctx.fillText('❌ 纠正前', 30, 30);
      ctx.fillText('✓ 纠正后', 30, half + 30);
    } else {
      ctx.fillText('❌ 纠正前', 30, 30);
      ctx.fillText('✓ 纠正后', half + 30, 30);
    }

    if (config.title) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      
      const titleY = height - 100;
      ctx.fillText(config.title, width / 2, titleY);
    }
  }

  private drawCoverImage(
    ctx: CanvasRenderingContext2D,
    imagePath: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const img = new Image();
    img.src = imagePath;
    
    const scale = Math.max(width / img.width, height / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const offsetX = x + (width - scaledWidth) / 2;
    const offsetY = y + (height - scaledHeight) / 2;
    
    ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
  }

  private renderTrainingStats(
    ctx: CanvasRenderingContext2D,
    trainingCount: number,
    width: number,
    height: number
  ): void {
    const badgeSize = 120;
    const badgeX = width - badgeSize - 30;
    const badgeY = 30;

    ctx.beginPath();
    ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#4caf50';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(trainingCount), badgeX + badgeSize / 2, badgeY + badgeSize / 2);

    ctx.font = 'bold 20px Arial';
    ctx.fillText('次', badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 40);
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ): void {
    const words = text.split('');
    let line = '';

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n];
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }
}
