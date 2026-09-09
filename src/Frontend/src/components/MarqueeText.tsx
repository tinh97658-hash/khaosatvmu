import { useLayoutEffect, useRef, useState } from 'react';
import '../styles/marquee-text.css';

interface MarqueeTextProps {
  /** Nội dung đầy đủ; phần tràn ra ngoài bị cắt bằng dấu ba chấm. */
  children: string;
  /** Thẻ bọc ngoài, mặc định là span để nhét vừa mọi ô bảng. */
  as?: 'span' | 'div';
  className?: string;
  /** Số giây chạy hết một vòng trên mỗi 100px chữ bị tràn. */
  secondsPer100px?: number;
}

/**
 * Chữ dài hơn ô thì cắt bằng dấu ba chấm; rê chuột vào thì chữ chạy ngang cho đọc
 * hết, đồng thời hiện một ô nhỏ bên dưới ghi trọn nội dung.
 *
 * Chỉ bật khi chữ THẬT SỰ tràn: đo bề rộng nội dung so với bề rộng ô, đo lại mỗi
 * khi ô đổi kích thước. Chữ vừa ô mà vẫn chạy thì chỉ tổ làm rối mắt.
 *
 * Cố ý không dùng `title` của trình duyệt cho phần chú thích: nó chờ cả giây mới
 * hiện, không đổi được kiểu, và trên bảng dài thì đọc rất mỏi.
 */
export function MarqueeText({
  children,
  as: Tag = 'span',
  className,
  secondsPer100px = 2.5,
}: MarqueeTextProps) {
  const viewportRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [overflowPx, setOverflowPx] = useState(0);
  const [viewportPx, setViewportPx] = useState(0);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const measure = () => {
      // So cả với ô ngoài lẫn với chính nó: tuỳ chỗ đặt mà bề rộng bị chặn ở lớp
      // nào, lấy giá trị lớn hơn thì không bỏ sót. Làm tròn xuống để lệch một
      // phần pixel do bo số của trình duyệt không bị hiểu nhầm thành tràn.
      setOverflowPx(
        Math.max(
          0,
          Math.floor(
            Math.max(
              content.scrollWidth - viewport.clientWidth,
              content.scrollWidth - content.clientWidth
            )
          )
        )
      );
      setViewportPx(viewport.clientWidth);
    };

    measure();

    // Đo lại sau khi trình duyệt vẽ xong và sau khi phông chữ tải xong: đo trong
    // useLayoutEffect là đo trên bố cục chưa chốt, bề rộng chữ còn tính bằng
    // phông dự phòng nên thường ra "không tràn" rồi đứng im mãi ở đó.
    const frame = requestAnimationFrame(measure);
    void document.fonts?.ready.then(measure).catch(() => {});

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [children]);

  const isOverflowing = overflowPx > 0;

  return (
    <Tag
      className={[
        'marquee-text',
        isOverflowing ? 'is-overflowing' : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
      // Quãng đường và thời lượng tính theo đúng phần chữ bị tràn, nên chữ dài
      // chạy lâu hơn chữ ngắn thay vì mọi thứ chạy cùng một tốc độ.
      style={
        {
          '--marquee-viewport': `${viewportPx}px`,
          '--marquee-duration': `${Math.max(2, (overflowPx / 100) * secondsPer100px)}s`,
        } as React.CSSProperties
      }
    >
      <span className="marquee-text-viewport" ref={viewportRef}>
        <span className="marquee-text-content" ref={contentRef}>
          {children}
        </span>
      </span>

      {isOverflowing && (
        <span className="marquee-text-full" role="tooltip">
          {children}
        </span>
      )}
    </Tag>
  );
}
