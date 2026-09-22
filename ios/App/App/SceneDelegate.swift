import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // Match Capacitor SplashScreen / StatusBar (#F4F8F9). Default UIWindow is black —
        // on some iPad simulators (esp. 13" M5) that shows as a full black screen while
        // the WKWebView is still coming up, or if the web layer is briefly transparent.
        let brandBackground = UIColor(red: 244 / 255, green: 248 / 255, blue: 249 / 255, alpha: 1)

        window = UIWindow(windowScene: windowScene)
        window?.backgroundColor = brandBackground
        let bridge = CAPBridgeViewController()
        bridge.view.backgroundColor = brandBackground
        window?.rootViewController = bridge
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
