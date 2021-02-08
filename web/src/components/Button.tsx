const Button: React.FC<React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <button
      className={`bg-gray-900 text-white text-sm font-medium rounded border border-gray-900 hover:bg-white hover:text-black ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
