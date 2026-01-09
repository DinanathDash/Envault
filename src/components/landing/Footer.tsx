import Link from "next/link"
import { ShieldCheck } from "lucide-react"

export function Footer() {
    return (
        <footer className="border-t bg-background/80 backdrop-blur-sm">
            <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0">
                <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                    <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                        Built by{" "}
                        <a
                            href="https://github.com/dinanathdash"
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium underline underline-offset-4"
                        >
                            Dinanath Dash
                        </a>
                        . The source code is available on{" "}
                        <a
                            href="https://github.com/dinanathdash/envault"
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium underline underline-offset-4"
                        >
                            GitHub
                        </a>
                        .
                    </p>
                </div>
                <div className="flex gap-4 items-center">
                    <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
                        Privacy
                    </Link>
                    <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
                        Terms
                    </Link>
                </div>
            </div>
        </footer>
    )
}
