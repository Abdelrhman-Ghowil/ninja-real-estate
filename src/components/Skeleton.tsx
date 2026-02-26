interface Props {
  height?: number | string;
  width?: number | string;
  style?: React.CSSProperties;
}

export default function Skeleton({ height = 20, width = '100%', style }: Props) {
  return (
    <div
      className="skeleton"
      style={{ height, width, ...style }}
    />
  );
}
