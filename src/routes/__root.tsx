import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRoute,
	HeadContent,
	Link,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Faktencheck 🔍",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
});

const navLinkClassName =
	"rounded px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900";
// `!` (important) guarantees these win over navLinkClassName's own
// text/background utilities regardless of Tailwind's generated CSS order,
// since both class lists are present together on the active link.
const navLinkActiveClassName = "!bg-gray-900 !text-white";

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="de">
			<head>
				<HeadContent />
			</head>
			<body>
				<nav className="mx-auto flex max-w-3xl gap-1 px-8 pt-6">
					<Link
						to="/"
						className={navLinkClassName}
						activeProps={{ className: navLinkActiveClassName }}
						activeOptions={{ exact: true }}
					>
						Transkript
					</Link>
					<Link
						to="/quick"
						className={navLinkClassName}
						activeProps={{ className: navLinkActiveClassName }}
					>
						Schnellcheck
					</Link>
				</nav>
				{children}
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
