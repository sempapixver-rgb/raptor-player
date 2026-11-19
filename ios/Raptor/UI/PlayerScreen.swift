import SwiftUI
import AVFoundation
import Combine

struct PlayerRoute: Identifiable {
    let id = UUID()
    let items: [PlayItem]
    let startIndex: Int
    let autoAdvance: Bool
}

// MARK: - Motor de reprodução

final class PlayerModel: ObservableObject {
    @Published var isPlaying = false
    @Published var position: Double = 0
    @Published var duration: Double?
    @Published var error: String?
    @Published var currentTitle = ""

    let player = AVPlayer()

    private let prefs = Prefs()
    private var items: [PlayItem] = []
    private var index = 0
    private var autoAdvance = false
    private var currentURL = ""
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var failObserver: NSObjectProtocol?
    private var lastSave = Date.distantPast

    var hasQueue: Bool { items.count > 1 }
    var queuePosition: String { "\(index + 1) de \(items.count)" }
    var canGoPrevious: Bool { index > 0 }
    var canGoNext: Bool { index < items.count - 1 }

    deinit {
        if let timeObserver { player.removeTimeObserver(timeObserver) }
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        if let failObserver { NotificationCenter.default.removeObserver(failObserver) }
    }

    func configure(items: [PlayItem], startIndex: Int, autoAdvance: Bool) {
        self.items = items
        self.autoAdvance = autoAdvance
        index = min(max(0, startIndex), max(0, items.count - 1))
        if timeObserver == nil {
            timeObserver = player.addPeriodicTimeObserver(
                forInterval: CMTime(value: 1, timescale: 2), queue: .main
            ) { [weak self] time in
                guard let self else { return }
                position = time.seconds
                if let item = player.currentItem {
                    let d = item.duration
                    if d.flags.contains(.valid) && !d.flags.contains(.indefinite) && d.seconds.isFinite && d.seconds > 0 {
                        duration = d.seconds
                    } else {
                        duration = nil
                    }
                }
                if isPlaying, Date().timeIntervalSince(lastSave) >= 10 {
                    savePosition()
                    lastSave = Date()
                }
            }
            endObserver = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime, object: nil, queue: .main
            ) { [weak self] _ in
                guard let self else { return }
                if autoAdvance && canGoNext { go(1) }
            }
            failObserver = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemFailedToPlayToEndTime, object: nil, queue: .main
            ) { [weak self] _ in
                self?.error = "Não foi possível reproduzir este vídeo."
            }
        }
        loadCurrent()
    }

    private func loadCurrent() {
        guard items.indices.contains(index) else { return }
        savePosition()
        let item = items[index]
        currentTitle = item.title
        currentURL = item.url
        position = 0
        duration = nil
        error = nil

        guard let url = URL(string: item.url) else {
            error = "Link de vídeo inválido."
            return
        }
        let playerItem = AVPlayerItem(url: url)
        player.replaceCurrentItem(with: playerItem)
        let saved = prefs.resumeFor(item.url)
        if saved > 5_000 {
            let target = CMTime(value: saved, timescale: 1000)
            player.seek(to: target) { [weak self] _ in
                self?.position = target.seconds
            }
        }
        player.play()
        isPlaying = true
        lastSave = Date()
    }

    func togglePlay() {
        if isPlaying { player.pause(); isPlaying = false }
        else { player.play(); isPlaying = true }
    }

    func seek(to seconds: Double) {
        guard let duration, duration > 0 else { return }
        let clamped = min(max(0, seconds), duration)
        player.seek(to: CMTime(seconds: clamped, preferredTimescale: 600))
        position = clamped
    }

    func skip(_ seconds: Double) { seek(to: position + seconds) }

    func go(_ delta: Int) {
        let target = min(max(0, index + delta), max(0, items.count - 1))
        guard target != index else { return }
        index = target
        loadCurrent()
    }

    func retry() {
        error = nil
        loadCurrent()
    }

    func savePosition() {
        guard !currentURL.isEmpty else { return }
        let seconds = player.currentTime().seconds
        guard seconds.isFinite, seconds > 0 else { return }
        prefs.saveResume(currentURL, position: Int64(seconds * 1000))
    }

    func close() {
        savePosition()
        player.pause()
        isPlaying = false
    }

    var speed: Float { player.rate }
    func setSpeed(_ rate: Float) {
        player.rate = rate
        isPlaying = rate > 0
    }
}

// MARK: - Camada de vídeo

private final class PlayerLayerContainer: UIView {
    override class var layerClass: AnyClass { AVPlayerLayer.self }
    var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }

    init(player: AVPlayer) {
        super.init(frame: .zero)
        playerLayer.player = player
        playerLayer.videoGravity = .resizeAspect
        backgroundColor = .black
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) não implementado") }
}

private struct PlayerLayerView: UIViewRepresentable {
    let player: AVPlayer

    func makeUIView(context: Context) -> PlayerLayerContainer {
        PlayerLayerContainer(player: player)
    }

    func updateUIView(_ uiView: PlayerLayerContainer, context: Context) {
        uiView.playerLayer.player = player
    }
}

// MARK: - Tela

struct PlayerScreen: View {
    @Environment(\.dismiss) private var dismiss
    let route: PlayerRoute

    @StateObject private var model = PlayerModel()
    @State private var controlsVisible = true

    private let speeds: [Float] = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            PlayerLayerView(player: model.player)
                .ignoresSafeArea()

            Color.clear
                .contentShape(Rectangle())
                .onTapGesture { withAnimation { controlsVisible.toggle() } }
                .ignoresSafeArea()

            if let error = model.error {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 36))
                        .foregroundStyle(RaptorColor.dim)
                    Text(error)
                        .font(.subheadline)
                        .foregroundStyle(RaptorColor.text)
                        .multilineTextAlignment(.center)
                    Button("Tentar novamente") { model.retry() }
                        .foregroundStyle(RaptorColor.green)
                }
                .padding(24)
                .background(RaptorColor.background.opacity(0.9))
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }

            if controlsVisible {
                VStack {
                    topBar
                    Spacer()
                    centerControls
                    Spacer()
                    bottomBar
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(
                    LinearGradient(
                        colors: [Color.black.opacity(0.75), .clear, .clear, Color.black.opacity(0.85)],
                        startPoint: .top, endPoint: .bottom
                    )
                    .ignoresSafeArea()
                )
                .transition(.opacity)
            }
        }
        .onAppear {
            model.configure(items: route.items, startIndex: route.startIndex, autoAdvance: route.autoAdvance)
        }
        .onDisappear { model.close() }
    }

    private var topBar: some View {
        HStack(spacing: 10) {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(9)
                    .background(Color.white.opacity(0.16))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)

            Text(model.currentTitle)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
                .lineLimit(1)

            Spacer()

            if model.hasQueue {
                Text(model.queuePosition)
                    .font(.caption2)
                    .foregroundStyle(RaptorColor.greenSoft)
            }

            Menu {
                ForEach(speeds, id: \.self) { speed in
                    Button("\(String(format: "%.2g", speed))x") { model.setSpeed(speed) }
                }
            } label: {
                Text("\(String(format: "%.2g", model.speed))x")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(RaptorColor.greenSoft)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    private var centerControls: some View {
        HStack(spacing: 24) {
            Button { model.go(-1) } label: {
                Image(systemName: "backward.end.fill")
                    .font(.title2)
                    .foregroundStyle(model.canGoPrevious ? .white : .white.opacity(0.3))
            }
            .disabled(!model.canGoPrevious)

            Button { model.togglePlay() } label: {
                Image(systemName: model.isPlaying ? "pause.fill" : "play.fill")
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 62, height: 62)
                    .background(Color.white.opacity(0.18))
                    .clipShape(Circle())
                    .overlay(Circle().stroke(RaptorColor.green, lineWidth: 2))
            }
            .buttonStyle(.plain)

            Button { model.go(1) } label: {
                Image(systemName: "forward.end.fill")
                    .font(.title2)
                    .foregroundStyle(model.canGoNext ? .white : .white.opacity(0.3))
            }
            .disabled(!model.canGoNext)
        }
    }

    @ViewBuilder
    private var bottomBar: some View {
        VStack(spacing: 8) {
            if let duration = model.duration, duration > 0 {
                Slider(value: Binding(
                    get: { model.position },
                    set: { model.seek(to: $0) }
                ), in: 0...duration)
                .tint(RaptorColor.green)

                HStack {
                    Text(formatTime(model.position))
                    Spacer()
                    Text(formatTime(duration))
                }
                .font(.caption2)
                .foregroundStyle(.white)

                HStack(spacing: 14) {
                    skipButton("-30s", -30)
                    skipButton("-5min", -300)
                    skipButton("+30s", 30)
                    skipButton("+5min", 300)
                }
            } else {
                HStack {
                    Text("AO VIVO")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(RaptorColor.green)
                    Spacer()
                }
            }
        }
    }

    private func skipButton(_ title: String, _ seconds: Double) -> some View {
        Button(title) { model.skip(seconds) }
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Color.white.opacity(0.14))
            .clipShape(Capsule())
    }

    private func formatTime(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds > 0 else { return "00:00" }
        let total = Int(seconds)
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        let secs = total % 60
        return hours > 0
            ? String(format: "%d:%02d:%02d", hours, minutes, secs)
            : String(format: "%02d:%02d", minutes, secs)
    }
}
