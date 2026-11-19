import Foundation

/// Clipes públicos usados no modo demonstração (mesmos do Android).
struct PlayItem: Identifiable, Equatable {
    let url: String
    let title: String

    var id: String { url + title }
}

enum Demo {
    private static let base = "https://github.com/sempapixver-rgb/raptor-player/releases/download/demo-media/"

    static let items: [PlayItem] = [
        PlayItem(url: base + "demo-1.mp4", title: "Exemplo 1 · Sintel (720p)"),
        PlayItem(url: base + "demo-2.mp4", title: "Exemplo 2 · Big Buck Bunny (trailer)"),
        PlayItem(url: base + "demo-3.mp4", title: "Exemplo 3 · Sintel (trailer)"),
        PlayItem(url: base + "demo-4.mp4", title: "Exemplo 4 · Águas-vivas (720p)")
    ]
}
