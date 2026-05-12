export default function Avatar({ username, size = 32 }) {
    const name = username || '?';
    const initial = name[0].toUpperCase();
    const hue = [...name].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;

    return (
        <div
            className="avatar"
            style={{
                width: size,
                height: size,
                backgroundColor: `hsl(${hue}, 45%, 42%)`,
                fontSize: size * 0.42,
            }}
        >
            {initial}
        </div>
    );
}
