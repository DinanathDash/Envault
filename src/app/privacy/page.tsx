import { Footer } from "@/components/landing/Footer"
import { ShieldCheck } from "lucide-react"
import Link from "next/link"

export default function PrivacyPage() {
    return (
        <div className="flex min-h-screen flex-col">
            <header className="container h-14 flex items-center px-4 lg:px-6 mt-4">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                    Envault
                </Link>
            </header>
            <main className="flex-1 container max-w-3xl py-12 px-4 md:px-6">
                <h1 className="text-3xl font-bold tracking-tight mb-8">Privacy Policy</h1>
                <div className="prose prose-stone dark:prose-invert max-w-none space-y-8">
                    <p className="lead">Last updated: {new Date().toLocaleDateString()}</p>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
                        <p className="text-muted-foreground">
                            Welcome to Envault ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal data.
                            This privacy policy will inform you as to how we look after your personal data when you visit our website
                            and tell you about your privacy rights and how the law protects you. By using our Service, you agree to the collection and use of information in accordance with this policy.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
                        <p className="text-muted-foreground mb-4">
                            We collect several different types of information for various purposes to provide and improve our Service to you.
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li>
                                <strong>Personal Data:</strong> While using our Service, we may ask you to provide us with certain personally identifiable information that can be used to contact or identify you ("Personal Data"). Personally identifiable information may include, but is not limited to: Email address, First name and last name, Cookies and Usage Data.
                            </li>
                            <li>
                                <strong>Usage Data:</strong> We may also collect information how the Service is accessed and used ("Usage Data"). This Usage Data may include information such as your computer's Internet Protocol address (e.g. IP address), browser type, browser version, the pages of our Service that you visit, the time and date of your visit, the time spent on those pages, unique device identifiers and other diagnostic data.
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">3. Data Security & Encryption</h2>
                        <p className="text-muted-foreground">
                            The security of your data is important to us. Envault employs end-to-end encryption for your stored environment variables.
                            Your secrets are encrypted on the client-side before being transmitted to our servers (if applicable)
                            or stored securely using our provider's infrastructure. We use industry-standard AES-256-GCM encryption.
                            However, please remember that no method of transmission over the Internet, or method of electronic storage is 100% secure.
                            While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">4. Use of Data</h2>
                        <p className="text-muted-foreground mb-4">
                            Envault uses the collected data for various purposes:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li>To provide and maintain the Service</li>
                            <li>To notify you about changes to our Service</li>
                            <li>To allow you to participate in interactive features of our Service when you choose to do so</li>
                            <li>To provide customer care and support</li>
                            <li>To provide analysis or valuable information so that we can improve the Service</li>
                            <li>To monitor the usage of the Service</li>
                            <li>To detect, prevent and address technical issues</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">5. Third-Party Service Providers</h2>
                        <p className="text-muted-foreground">
                            We may employ third party companies and individuals to facilitate our Service ("Service Providers"), to provide the Service on our behalf, to perform Service-related services or to assist us in analyzing how our Service is used.
                            These third parties have access to your Personal Data only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.
                            Examples include <strong>Supabase</strong> for authentication and database services, and <strong>Upstash</strong> for data storage.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">6. Data Retention</h2>
                        <p className="text-muted-foreground">
                            We will retain your Personal Data only for as long as is necessary for the purposes set out in this Privacy Policy. We will retain and use your Personal Data to the extent necessary to comply with our legal obligations (for example, if we are required to retain your data to comply with applicable laws), resolve disputes, and enforce our legal agreements and policies.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">7. Your Data Rights</h2>
                        <p className="text-muted-foreground mb-4">
                            Depending on your location, you may have the following rights regarding your personal data:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li>The right to access, update or to delete the information we have on you.</li>
                            <li>The right of rectification.</li>
                            <li>The right to object.</li>
                            <li>The right of restriction.</li>
                            <li>The right to data portability.</li>
                            <li>The right to withdraw consent.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">8. Changes to This Privacy Policy</h2>
                        <p className="text-muted-foreground">
                            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.
                            We will let you know via email and/or a prominent notice on our Service, prior to the change becoming effective and update the "effective date" at the top of this Privacy Policy.
                            You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">9. Contact Us</h2>
                        <p className="text-muted-foreground">
                            If you have any questions about this privacy policy, please contact us at dashdinanath056@gmail.com.
                        </p>
                    </section>
                </div>
            </main>
            <Footer />
        </div>
    )
}
