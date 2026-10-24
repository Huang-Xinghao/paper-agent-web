import { Empty, Image } from 'antd';
import { api, type ProjectFile } from '../../api/client';
export function FigureGallery({ projectId, files }: { projectId: string; files: ProjectFile[] }) {
  const images = files.filter((file) => /\.(png|jpe?g|webp)$/i.test(file.path));
  if (!images.length) return <Empty description="暂无图片；生成的研究图表将在这里展示" />;
  return (
    <Image.PreviewGroup>
      <div className="figure-gallery">
        {images.map((file) => (
          <figure key={file.path}>
            <Image src={api.download(projectId, file.path)} alt={file.path} loading="lazy" />
            <figcaption title={file.path}>{file.path}</figcaption>
          </figure>
        ))}
      </div>
    </Image.PreviewGroup>
  );
}
