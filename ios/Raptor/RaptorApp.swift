import SwiftUI
import UIKit

final class AppDelegate: NSObject, UIApplicationDelegate {
    /// Retrato nas telas do app; o player pode girar.
    static var orientationMask: UIInterfaceOrientationMask = .portrait

    func application(_ application: UIApplication,
                     supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        Self.orientationMask
    }
}

@main
struct RaptorApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var store = RaptorStore()
    @State private var route: PlayerRoute?

    var body: some Scene {
        WindowGroup {
            ZStack {
                if !store.termsAccepted {
                    TermsScreen { store.acceptTerms() }
                } else if store.current != nil {
                    HomeScreen(route: $route)
                } else {
                    LoginScreen {
                        route = PlayerRoute(items: Demo.items, startIndex: 0, autoAdvance: true)
                    }
                }
            }
            .environmentObject(store)
            .fullScreenCover(item: $route) { route in
                PlayerScreen(route: route)
            }
            .onChange(of: route) { newValue in
                AppDelegate.orientationMask = newValue == nil ? .portrait : .allButUpsideDown
            }
        }
    }
}
