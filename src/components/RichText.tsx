import { Fragment } from 'react';

/**
 * Định dạng tối giản cho nội dung soạn trong trang admin:
 *   · dòng trống ngăn đoạn
 *   · **chữ đậm**
 *   · xuống dòng đơn giữ nguyên
 * Không cho phép HTML thô, nên nội dung admin nhập không thể chèn thẻ vào trang.
 */
function withBold(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>;
  });
}

export default function RichText({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());

  return (
    <div className={className ?? 'reading'}>
      {paragraphs.map((para, pi) => (
        <p key={pi}>
          {para.split('\n').map((line, li, arr) => (
            <Fragment key={li}>
              {withBold(line, `${pi}-${li}`)}
              {li < arr.length - 1 ? <br /> : null}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
