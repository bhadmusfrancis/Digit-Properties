import Link from 'next/link';

export const metadata = {
  title: 'About Us | Digit Properties',
  description:
    'Digit Properties offers real estate advertisement, property development, land titling, development documentation, and document verification including Survey and Certificate of Occupancy (C of O) in Nigeria.',
};

export default function AboutPage() {
  return (
    <div>
      <section className="relative bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">About Digit Properties</h1>
          <p className="mt-4 max-w-2xl text-xl text-primary-100">
            Your trusted partner for real estate advertisement, property development, land titling, development documentation, and document verification across Nigeria.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-lg text-gray-600">
          Digit Properties is a Nigerian real estate platform that connects buyers, sellers, renters, and developers with the right properties and the right paperwork. We develop property ourselves and support others with land titling, development documentation, and verification of key documents such as Survey plans and Certificates of Occupancy (C of O).
        </p>
      </section>

      <section className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900">What We Do</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-1 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-600 font-bold">
                1
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">Real Estate Advertisement</h3>
              <p className="mt-2 text-gray-600">
                We run a modern property marketplace where agents, developers, and private owners can list land, houses, apartments, and commercial spaces for sale or rent. Buyers and renters can search by location, price, and property type and connect directly with listing owners. Featured and highlighted listings help serious sellers stand out.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-600 font-bold">
                2
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">Land Titling</h3>
              <p className="mt-2 text-gray-600">
                We support clients through the process of securing and regularizing land titles in Nigeria. Whether you are purchasing land, regularizing existing occupation, or preparing for development, we help navigate the steps required to obtain or verify title documents in line with state and federal requirements.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-600 font-bold">
                3
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">Property Development & Documentation</h3>
              <p className="mt-2 text-gray-600">
                We develop property—building and delivering residential and commercial projects—and we support developers and investors with the full documentation needed for property development. That includes approvals, permits, and the paperwork required to develop land or buildings legally and in compliance with local regulations.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-600 font-bold">
                4
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">Document Verification (Survey & C of O)</h3>
              <p className="mt-2 text-gray-600">
                We offer document verification services so you can transact with more confidence. This includes verification of Survey plans and Certificate of Occupancy (C of O) and related title documents. Confirming that these documents are genuine and properly registered helps reduce risk in property transactions.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900">Why Digit Properties</h2>
        <ul className="mt-6 list-inside list-disc space-y-2 text-gray-600">
          <li>One platform for finding properties and managing the documentation side of real estate.</li>
          <li>Transparent listings with filters by location, price, and type so you find what you need quickly.</li>
          <li>We develop property and support land titling and development documentation tailored to Nigerian practice.</li>
          <li>Document verification services (Survey and C of O) to help you verify before you buy or invest.</li>
        </ul>
        <p className="mt-8 text-gray-600">
          Whether you are looking to buy, sell, rent, or develop property in Nigeria, Digit Properties is here to help you advertise, develop, document, and verify with confidence.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/listings" className="btn-primary">
            Browse properties
          </Link>
          <Link href="/contact" className="btn border-2 border-primary-600 text-primary-600 hover:bg-primary-50">
            Contact us
          </Link>
        </div>
      </section>
    </div>
  );
}
