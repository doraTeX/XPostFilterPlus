import AppKit
import Foundation

// 元の暗い背景・傾いた白いX・同じ長さのピンクのバーに、右上の＋を加える。
let ink = NSColor(calibratedRed: 0.07, green: 0.17, blue: 0.25, alpha: 1)
let pink = NSColor(calibratedRed: 0.96, green: 0.48, blue: 0.65, alpha: 1)
let yellow = NSColor(calibratedRed: 1, green: 0.83, blue: 0.12, alpha: 1)
let shear: CGFloat = 0.22

// Xと＋の傾きを、この一つの変換で揃える。基準の高さは配置だけに影響する。
func shearedPoint(_ x: CGFloat, _ y: CGFloat, around originY: CGFloat) -> NSPoint {
    NSPoint(x: x + shear * (y - originY), y: y)
}

for size in [16, 48, 128] {
    let image = NSImage(size: NSSize(width: size, height: size))
    image.lockFocus()
    let scale = CGFloat(size) / 128
    NSGraphicsContext.current!.imageInterpolation = .high
    let transform = NSAffineTransform()
    transform.scaleX(by: scale, yBy: scale)
    transform.concat()

    ink.setFill()
    NSBezierPath(roundedRect: NSRect(x: 2, y: 2, width: 124, height: 124), xRadius: 26, yRadius: 26).fill()

    // 上側を右へずらし、文字全体を傾ける。
    func point(_ x: CGFloat, _ y: CGFloat) -> NSPoint {
        shearedPoint(x, y, around: 66)
    }
    NSColor.white.setFill()
    for points: [(CGFloat, CGFloat)] in [
        [(23, 107), (42, 107), (94, 30), (75, 30)],
        [(76, 107), (94, 107), (42, 30), (24, 30)]
    ] {
        let path = NSBezierPath()
        path.move(to: point(points[0].0, points[0].1))
        for p in points.dropFirst() { path.line(to: point(p.0, p.1)) }
        path.close()
        path.fill()
    }

    // 大きい黄色の＋をXの右上に少し重ね、同じシアーをかける。
    let plus = NSBezierPath()
    let plusStroke: CGFloat = size == 16 ? 10 : 9
    let plusX: CGFloat = 105, plusY: CGFloat = 101, plusLength: CGFloat = 34
    for rect in [
        NSRect(x: plusX - plusStroke / 2, y: plusY - plusLength / 2, width: plusStroke, height: plusLength),
        NSRect(x: plusX - plusLength / 2, y: plusY - plusStroke / 2, width: plusLength, height: plusStroke)
    ] {
        let corners = [(rect.minX, rect.minY), (rect.maxX, rect.minY), (rect.maxX, rect.maxY), (rect.minX, rect.maxY)]
        for (index, p) in corners.enumerated() {
            let sheared = shearedPoint(p.0, p.1, around: plusY)
            if index == 0 { plus.move(to: sheared) } else { plus.line(to: sheared) }
        }
        plus.close()
    }
    NSColor.black.setStroke()
    plus.lineWidth = 3
    plus.lineJoinStyle = .round
    plus.stroke()
    yellow.setFill()
    plus.fill()

    // 文字の下部を覆う2本のバー。幅はどちらも同じ。
    for y: CGFloat in [12, 31] {
        let bar = NSBezierPath(roundedRect: NSRect(x: 13, y: y, width: 102, height: 12), xRadius: 5, yRadius: 5)
        pink.setFill()
        bar.fill()
        ink.setStroke()
        bar.lineWidth = 2.5
        bar.stroke()
    }
    image.unlockFocus()

    let target = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: target)
    image.draw(in: NSRect(x: 0, y: 0, width: size, height: size))
    NSGraphicsContext.restoreGraphicsState()
    try target.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "public/icons/icon\(size).png"))
    print("生成: icon\(size).png")
}
