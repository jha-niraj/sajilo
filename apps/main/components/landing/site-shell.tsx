import "./art/art.css"
import { ArtRoot } from "./art/art-root"
import { SiteFooter } from "./site-footer"
import { SiteNav } from "./site-nav"

/** The public pages' frame: sticky nav, the page, the footer. Pixel art inside stops under reduced motion. */
export function SiteShell({ children }: { children: React.ReactNode }) {
    return (
        <ArtRoot className="min-h-dvh bg-paper text-ink">
            <SiteNav />
            <main>{children}</main>
            <SiteFooter />
        </ArtRoot>
    )
}
