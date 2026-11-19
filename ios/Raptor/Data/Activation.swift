import Foundation
import UIKit

/// Ativação pelo site, equivalente ao Activation.kt do Android.
enum Activation {
    static let siteBase = "https://raptor-player.netlify.app"

    static func normalize(_ code: String) -> String {
        let allowed = code.uppercased().unicodeScalars.filter { ($0 >= "A" && $0 <= "Z") || ($0 >= "0" && $0 <= "9") }
        return String(String.UnicodeScalarView(allowed))
    }

    static func deviceCode(prefs: Prefs) -> String {
        if let saved = prefs.deviceCode(), !saved.isEmpty { return saved }
        let vendor = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
        let hash = RaptorUtil.javaHash(vendor + "|" + UIDevice.current.model)
        let unsigned = UInt32(bitPattern: hash)
        let raw = String(format: "%08X%04X", unsigned, UInt16(truncatingIfNeeded: unsigned))
        let code = stride(from: 0, to: 12, by: 2).map { index in
            String(raw.dropFirst(index).prefix(2))
        }.joined(separator: ":")
        prefs.setDeviceCode(code)
        return code
    }

    static func siteURL(for code: String) -> URL? {
        URL(string: "\(siteBase)/?code=\(RaptorUtil.enc(normalize(code)))")
    }

    static func fetch(code: String) async -> Session? {
        let clean = normalize(code)
        guard !clean.isEmpty,
              let url = URL(string: "\(siteBase)/api/device?code=\(RaptorUtil.enc(clean))") else { return nil }
        var request = URLRequest(url: url)
        request.timeoutInterval = 8
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  obj["ok"] as? Bool == true,
                  let activation = obj["activation"] as? [String: Any] else { return nil }

            let label = (activation["label"] as? String ?? "").trimmingCharacters(in: .whitespaces)
            let mode = (activation["mode"] as? String ?? "").uppercased() == "M3U" ? LoginMode.link : .service
            if mode == .link {
                let m3u = activation["m3u"] as? String ?? ""
                guard !m3u.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
                return Session(mode: .link, linkUrl: m3u, label: label.isEmpty ? "Ativado pelo site" : label)
            }
            let host = activation["host"] as? String ?? ""
            let user = activation["user"] as? String ?? ""
            let pass = activation["pass"] as? String ?? ""
            guard !host.isEmpty, !user.isEmpty, !pass.isEmpty else { return nil }
            return Session(
                mode: .service,
                baseUrl: host,
                username: user,
                password: pass,
                label: label.isEmpty ? "Ativado pelo site" : label
            )
        } catch {
            return nil
        }
    }

    /// QR gerado localmente com Core Image (sem depender de serviços externos).
    static func qrImage(from text: String) -> UIImage? {
        guard let data = text.data(using: .utf8),
              let filter = CIFilter(name: "CIQRCodeGenerator") else { return nil }
        filter.setValue(data, forKey: "inputMessage")
        filter.setValue("M", forKey: "inputCorrectionLevel")
        guard let ciImage = filter.outputImage else { return nil }
        let scaled = ciImage.transformed(by: CGAffineTransform(scaleX: 8, y: 8))
        return UIImage(ciImage: scaled)
    }
}
