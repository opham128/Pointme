//
//  CompassHeading.swift
//  Pointme
//
//  Based on working Swift compass implementation
//  Exact copy of the working Swift code, bridged to React Native
//

import Foundation
import CoreLocation
import React

@objc(CompassHeading)
class CompassHeading: RCTEventEmitter, CLLocationManagerDelegate {
    private let locationManager: CLLocationManager
    
    override init() {
        self.locationManager = CLLocationManager()
        super.init()
        self.locationManager.delegate = self
    }
    
    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }
    
    override func supportedEvents() -> [String]! {
        return ["headingDidUpdate", "headingError"]
    }
    
    @objc func startObserving() {
        setup()
    }
    
    @objc func stopObserving() {
        locationManager.stopUpdatingHeading()
        locationManager.stopUpdatingLocation()
    }
    
    private func setup() {
        locationManager.requestWhenInUseAuthorization()
        
        if CLLocationManager.headingAvailable() {
            locationManager.startUpdatingLocation()
            locationManager.startUpdatingHeading()
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        // Exact match to Swift code: degrees = -1 * newHeading.magneticHeading
        let degrees = -1 * newHeading.magneticHeading
        
        // Normalize to 0-360
        let normalizedDegrees = degrees < 0 ? degrees + 360 : degrees
        
        // Send to React Native
        sendEvent(withName: "headingDidUpdate", body: ["heading": normalizedDegrees])
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        sendEvent(withName: "headingError", body: ["error": error.localizedDescription])
    }
}

