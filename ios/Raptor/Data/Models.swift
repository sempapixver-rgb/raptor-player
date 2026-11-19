import Foundation

enum LoginMode: String, Codable {
    case service
    case link
}

enum MediaKind: String, Codable {
    case live
    case vod
    case series

    var label: String {
        switch self {
        case .live: return "Canais"
        case .vod: return "Filmes"
        case .series: return "Séries"
        }
    }
}

struct Session: Codable, Equatable, Identifiable {
    var mode: LoginMode
    var baseUrl: String = ""
    var username: String = ""
    var password: String = ""
    var linkUrl: String = ""
    var label: String = ""

    /// Mesma normalização do Android (Session.normalizedBase).
    func normalizedBase() -> String {
        var s = baseUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        if !s.contains("://") { s = "http://" + s }
        if let q = s.firstIndex(of: "?") { s = String(s[..<q]) }
        if let h = s.firstIndex(of: "#") { s = String(s[..<h]) }
        while s.hasSuffix("/") { s.removeLast() }
        let suffixes = ["/player_api.php", "/get.php", "/panel_api.php", "/xmltv.php"]
        for suffix in suffixes {
            if s.lowercased().hasSuffix(suffix) {
                s = String(s.dropLast(suffix.count))
            }
        }
        while s.hasSuffix("/") { s.removeLast() }
        return s
    }

    func key() -> String {
        "\(mode.rawValue)|\(normalizedBase())|\(username.trimmingCharacters(in: .whitespaces))|\(linkUrl.trimmingCharacters(in: .whitespaces))"
    }

    var id: String { key() }

    func displayName() -> String {
        let trimmed = label.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { return trimmed }
        switch mode {
        case .service:
            var base = normalizedBase()
            if let r = base.range(of: "://") { base = String(base[r.upperBound...]) }
            return base.isEmpty ? "Xtream Codes" : base
        case .link:
            var s = linkUrl
            if let q = s.firstIndex(of: "?") { s = String(s[..<q]) }
            let last = s.components(separatedBy: "/").last ?? ""
            let name = (last as NSString).deletingPathExtension
            return name.isEmpty ? "Lista M3U" : name
        }
    }
}

struct Category: Codable, Equatable, Identifiable {
    var id: String
    var name: String
}

struct MediaEntry: Codable, Equatable, Identifiable {
    var id: String
    var name: String
    var logo: String?
    var categoryId: String?
    var kind: MediaKind
    var containerExtension: String?
    var directUrl: String?
    var rating: Double?
    var plot: String?
    var year: String?
    var categoryIds: [String] = []

    func allCategoryIds() -> [String] {
        var out: [String] = []
        if let categoryId, !categoryId.isEmpty { out.append(categoryId) }
        for c in categoryIds where !out.contains(c) { out.append(c) }
        return out
    }
}

struct Episode: Codable, Equatable, Identifiable {
    var id: String
    var title: String
    var season: Int
    var number: Int
    var url: String
    var plot: String?
    var duration: String?
    var logo: String?

    var idValue: String { id }
}

struct Season: Codable, Equatable, Identifiable {
    var number: Int
    var episodes: [Episode]

    var id: Int { number }
}

struct SeriesDetail: Codable, Equatable, Identifiable {
    var id: String
    var name: String
    var cover: String?
    var plot: String?
    var cast: String?
    var genre: String?
    var displayGenre: String?
    var releaseDate: String?
    var rating: Double?
    var seasons: [Season] = []
    var genres: [String] = []

    func allGenres() -> [String] {
        var out: [String] = []
        if let genre, !genre.isEmpty { out.append(genre) }
        for g in genres where !out.contains(g) { out.append(g) }
        return out
    }
}

struct EpgProgram: Codable, Equatable, Identifiable {
    var startMinutes: Int
    var start: String
    var title: String
    var genre: String?

    var id: String { "\(start)-\(title)" }
}

struct ChannelEpg: Equatable {
    var channelName: String
    var programs: [EpgProgram]

    func current(nowMinutes: Int) -> EpgProgram? {
        programs.last { $0.startMinutes <= nowMinutes } ?? programs.first
    }

    func upcoming(nowMinutes: Int, count: Int = 4) -> [EpgProgram] {
        Array(programs.filter { $0.startMinutes > nowMinutes }.prefix(count))
    }
}

struct AccountInfo: Equatable {
    var username: String
    var status: String
    var expiresAt: String
    var maxConnections: String
    var activeConnections: String
    var isTrial: Bool
}

struct DetectedLink {
    var mode: LoginMode
    var host: String = ""
    var user: String = ""
    var pass: String = ""
    var link: String = ""
}

// MARK: - Helpers compartilhados com o Kotlin

enum RaptorUtil {
    /// Java URLEncoder.encode: espaço vira "+".
    static func enc(_ value: String) -> String {
        let unreserved = Set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.~".unicodeScalars.map { $0.value })
        var out = ""
        for byte in Array(value.utf8) {
            if unreserved.contains(UInt32(byte)) {
                out.append(Character(UnicodeScalar(byte)))
            } else if byte == 0x20 {
                out += "+"
            } else {
                out += String(format: "%%%02X", byte)
            }
        }
        return out
    }

    /// String.hashCode() do Java, com overflow de Int32.
    static func javaHash(_ value: String) -> Int32 {
        var h: Int32 = 0
        for scalar in value.unicodeScalars {
            h = h &* 31 &+ Int32(bitPattern: scalar.value)
        }
        return h
    }

    static func hexJavaHash(_ value: String) -> String {
        let bits = UInt32(bitPattern: javaHash(value))
        return String(bits, radix: 16)
    }

    static func normalizeRemoteUrl(_ raw: String) -> String {
        let s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("http://") || s.hasPrefix("https://") || s.hasPrefix("file:") { return s }
        return "http://" + s
    }

    static func fold(_ value: String) -> String {
        let lowered = value.lowercased()
        let folded = lowered.folding(options: .diacriticInsensitive, locale: Locale(identifier: "pt-BR"))
        let letters = folded.map { c -> String in
            let ok = (c >= "a" && c <= "z") || (c >= "0" && c <= "9")
            return ok ? String(c) : " "
        }
        return letters.joined().trimmingCharacters(in: .whitespaces)
            .components(separatedBy: .whitespaces).filter { !$0.isEmpty }.joined(separator: " ")
    }

    static func stripQuality(_ value: String) -> String {
        let tokens = ["fhd", "uhd", "hd", "sd", "4k", "8k", "h265", "hevc", "h264", "alt", "backup", "raw", "full"]
        var out = fold(value)
        for token in tokens {
            out = out.replacingOccurrences(of: token, with: "")
        }
        return fold(out)
    }

    static func toMinutes(_ time: String) -> Int {
        let parts = time.split(separator: ":").compactMap { Int($0) }
        guard parts.count >= 2 else { return 0 }
        return parts[0] * 60 + parts[1]
    }
}
