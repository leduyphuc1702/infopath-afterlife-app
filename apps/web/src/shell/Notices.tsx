// Spec 09 R7.2: the way to the notices page (`notices.html`, written by plugins/notices.ts).
export function Notices() {
  return (
    <footer className="afl-footer">
      <span>Open source under the MIT licence.</span>{' '}
      <a href="./notices.html">Licences and notices</a>
      <span className="afl-sub">
        InfoPath is a trademark of Microsoft. This project is not affiliated with Microsoft or
        Atlassian.
      </span>
    </footer>
  );
}
