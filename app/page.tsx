import Link from "next/dist/client/link";
import Image from "next/image";

export default function Home() {
  return (
    <main>
      hello world

      <Link href="/login">Login</Link>
      <Link href="/signup">signup</Link>
    </main>
  );
}
