import type { ReactNode } from "react";

interface IconButtonProps {
	onClick: () => void;
	label: string;
	children: ReactNode;
}

/** 아이콘 버튼 컴포넌트 */
export function IconButton({ onClick, label, children }: IconButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			className="flex cursor-pointer items-center justify-center rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
		>
			{children}
		</button>
	);
}
